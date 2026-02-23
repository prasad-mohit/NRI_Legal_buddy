"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
  type AudioVideoObserver,
} from "amazon-chime-sdk-js";
import clsx from "clsx";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, RotateCw, Video } from "lucide-react";

interface MeetingRoomProps {
  meetingId: string;
}

interface JoinMeetingResponse {
  meetingId: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  join: {
    meeting: unknown;
    attendee: unknown;
    attendeeId: string;
    expiresAt: string;
  };
}

interface TileDescriptor {
  tileId: number;
  attendeeId: string;
  isLocal: boolean;
  isContent: boolean;
}

type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

const cardShell =
  "rounded-3xl border border-slate-200 bg-white shadow-[0_24px_56px_rgba(15,23,42,0.10)]";

const parseErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { message?: string };
    if (data.message) return data.message;
  } catch {
    // ignore parse failures
  }
  return fallback;
};

const prettyDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export function MeetingRoom({ meetingId }: MeetingRoomProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [meetingMeta, setMeetingMeta] = useState<{
    caseId: string;
    scheduledAt: string;
    expiresAt: string;
  } | null>(null);
  const [tiles, setTiles] = useState<TileDescriptor[]>([]);

  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const meetingObserverRef = useRef<AudioVideoObserver | null>(null);
  const tileElementRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const attendeeIdRef = useRef<string | null>(null);
  const leftMeetingRef = useRef(false);

  const bindTileElement = useCallback((tileId: number, element: HTMLVideoElement | null) => {
    if (element) {
      tileElementRef.current.set(tileId, element);
      const session = meetingSessionRef.current;
      if (session) {
        session.audioVideo.bindVideoElement(tileId, element);
      }
      return;
    }
    tileElementRef.current.delete(tileId);
  }, []);

  const leaveMeeting = useCallback(
    async (notifyServer: boolean) => {
      if (leftMeetingRef.current) return;
      leftMeetingRef.current = true;

      const attendeeId = attendeeIdRef.current;
      attendeeIdRef.current = null;

      const session = meetingSessionRef.current;
      if (session) {
        if (meetingObserverRef.current) {
          session.audioVideo.removeObserver(meetingObserverRef.current);
        }
        try {
          session.audioVideo.stopContentShare();
        } catch {
          // noop
        }
        try {
          session.audioVideo.stopLocalVideoTile();
        } catch {
          // noop
        }
        try {
          session.audioVideo.stopVideoInput();
        } catch {
          // noop
        }
        try {
          session.audioVideo.stopAudioInput();
        } catch {
          // noop
        }
        session.audioVideo.stop();
      }

      meetingSessionRef.current = null;
      meetingObserverRef.current = null;
      tileElementRef.current.clear();
      setTiles([]);
      setConnectionState("disconnected");
      setIsScreenSharing(false);

      if (notifyServer && attendeeId) {
        try {
          await fetch("/api/video/join", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetingId, attendeeId }),
            keepalive: true,
          });
        } catch {
          // ignore best-effort leave reporting failures
        }
      }
    },
    [meetingId]
  );

  useEffect(() => {
    let canceled = false;
    leftMeetingRef.current = false;

    const startMeeting = async () => {
      setLoading(true);
      setError(null);
      setStatusMessage(null);
      setConnectionState("connecting");

      try {
        const res = await fetch(`/api/video/join?meetingId=${encodeURIComponent(meetingId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const message = await parseErrorMessage(res, "Unable to join meeting");
          throw new Error(message);
        }

        const payload = (await res.json()) as JoinMeetingResponse;
        if (canceled) return;

        attendeeIdRef.current = payload.join.attendeeId;
        setMeetingMeta({
          caseId: payload.caseId,
          scheduledAt: payload.scheduledAt,
          expiresAt: payload.join.expiresAt,
        });

        const logger = new ConsoleLogger("meeting-room", LogLevel.ERROR);
        const deviceController = new DefaultDeviceController(logger);
        const config = new MeetingSessionConfiguration(
          payload.join.meeting as any,
          payload.join.attendee as any
        );
        const session = new DefaultMeetingSession(config, logger, deviceController);
        meetingSessionRef.current = session;

        const observer: AudioVideoObserver = {
          audioVideoDidStart: () => {
            setConnectionState("connected");
            setStatusMessage(null);
          },
          audioVideoDidStartConnecting: (reconnecting) => {
            if (reconnecting) {
              setConnectionState("reconnecting");
              setStatusMessage("Reconnecting to meeting...");
              return;
            }
            setConnectionState("connecting");
          },
          audioVideoDidStop: (status) => {
            setConnectionState("disconnected");
            setStatusMessage(`Meeting stopped (${String(status.statusCode())}).`);
          },
          videoTileDidUpdate: (tile) => {
            const tileId = tile.tileId;
            const attendeeId = tile.boundAttendeeId;
            if (tileId === null || tileId === undefined || !attendeeId) return;

            setTiles((prev) => {
              const index = prev.findIndex((item) => item.tileId === tileId);
              const nextTile: TileDescriptor = {
                tileId,
                attendeeId,
                isLocal: Boolean(tile.localTile),
                isContent: Boolean(tile.isContent),
              };
              if (index === -1) return [...prev, nextTile];
              const next = [...prev];
              next[index] = nextTile;
              return next;
            });

            const videoElement = tileElementRef.current.get(tileId);
            if (videoElement) {
              session.audioVideo.bindVideoElement(tileId, videoElement);
            }
          },
          videoTileWasRemoved: (tileId) => {
            setTiles((prev) => prev.filter((item) => item.tileId !== tileId));
            tileElementRef.current.delete(tileId);
          },
        };

        meetingObserverRef.current = observer;
        session.audioVideo.addObserver(observer);

        const audioDevices = await session.audioVideo.listAudioInputDevices();
        if (audioDevices[0]) {
          await session.audioVideo.startAudioInput(audioDevices[0].deviceId);
        }

        const videoDevices = await session.audioVideo.listVideoInputDevices();
        if (videoDevices[0]) {
          await session.audioVideo.startVideoInput(videoDevices[0].deviceId);
        }

        session.audioVideo.start();
        session.audioVideo.startLocalVideoTile();
        setLoading(false);
      } catch (joinError) {
        if (canceled) return;
        setLoading(false);
        setConnectionState("disconnected");
        setError(joinError instanceof Error ? joinError.message : "Unable to join meeting");
      }
    };

    void startMeeting();

    return () => {
      canceled = true;
      void leaveMeeting(true);
    };
  }, [leaveMeeting, meetingId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void leaveMeeting(true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [leaveMeeting]);

  const toggleMute = useCallback(() => {
    const session = meetingSessionRef.current;
    if (!session) return;
    if (isMuted) {
      session.audioVideo.realtimeUnmuteLocalAudio();
      setIsMuted(false);
      return;
    }
    session.audioVideo.realtimeMuteLocalAudio();
    setIsMuted(true);
  }, [isMuted]);

  const toggleScreenShare = useCallback(async () => {
    const session = meetingSessionRef.current;
    if (!session) return;

    if (isScreenSharing) {
      session.audioVideo.stopContentShare();
      setIsScreenSharing(false);
      return;
    }

    try {
      await session.audioVideo.startContentShareFromScreenCapture();
      setIsScreenSharing(true);
      setStatusMessage(null);
    } catch {
      setStatusMessage("Screen share is unavailable or permission was denied.");
    }
  }, [isScreenSharing]);

  const endCall = useCallback(async () => {
    await leaveMeeting(true);
    router.push("/");
  }, [leaveMeeting, router]);

  const remoteTiles = useMemo(() => tiles.filter((tile) => !tile.isLocal), [tiles]);
  const localTiles = useMemo(() => tiles.filter((tile) => tile.isLocal), [tiles]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className={clsx(cardShell, "flex flex-wrap items-center justify-between gap-3 p-5")}>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Legal Video Consultation</p>
            <h1 className="text-2xl font-semibold">Amazon Chime Meeting Room</h1>
            <p className="text-sm text-slate-600">
              Meeting ID: {meetingId}
              {meetingMeta ? ` • Case: ${meetingMeta.caseId}` : ""}
            </p>
            {meetingMeta ? (
              <p className="text-xs text-slate-500">
                Scheduled: {prettyDateTime(meetingMeta.scheduledAt)} • Token expires:{" "}
                {prettyDateTime(meetingMeta.expiresAt)}
              </p>
            ) : null}
          </div>
          <div
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
              connectionState === "connected" && "bg-emerald-100 text-emerald-800",
              connectionState === "reconnecting" && "bg-amber-100 text-amber-900",
              connectionState === "connecting" && "bg-blue-100 text-blue-800",
              connectionState === "disconnected" && "bg-rose-100 text-rose-800"
            )}
          >
            {connectionState}
          </div>
        </section>

        {error ? (
          <section className={clsx(cardShell, "p-5 text-sm")}>
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              <RotateCw className="h-4 w-4" /> Retry join
            </button>
          </section>
        ) : null}

        {statusMessage ? (
          <section className={clsx(cardShell, "p-4 text-sm text-slate-700")}>{statusMessage}</section>
        ) : null}

        <section className={clsx(cardShell, "p-4")}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                Connecting to meeting...
              </div>
            ) : null}

            {!loading && !tiles.length ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Video tiles will appear when participants connect.
              </div>
            ) : null}

            {remoteTiles.map((tile) => (
              <article
                key={tile.tileId}
                className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-950"
              >
                <video
                  ref={(element) => bindTileElement(tile.tileId, element)}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[11px] text-white">
                  {tile.isContent ? "Content share" : "Participant"} • {tile.attendeeId}
                </div>
              </article>
            ))}

            {localTiles.map((tile) => (
              <article
                key={tile.tileId}
                className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-900"
              >
                <video
                  ref={(element) => bindTileElement(tile.tileId, element)}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[11px] text-white">
                  You
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={clsx(cardShell, "flex flex-wrap items-center gap-3 p-5")}>
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            {isMuted ? <MicOff className="h-4 w-4 text-rose-600" /> : <Mic className="h-4 w-4 text-emerald-600" />}
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => void toggleScreenShare()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            {isScreenSharing ? (
              <MonitorX className="h-4 w-4 text-rose-600" />
            ) : (
              <MonitorUp className="h-4 w-4 text-blue-600" />
            )}
            {isScreenSharing ? "Stop Share" : "Share Screen"}
          </button>
          <button
            type="button"
            onClick={endCall}
            className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <PhoneOff className="h-4 w-4" /> End Call
          </button>
          <div className="ml-auto inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            <Video className="h-3 w-3" /> Reconnect handling is active
          </div>
        </section>
      </div>
    </main>
  );
}
