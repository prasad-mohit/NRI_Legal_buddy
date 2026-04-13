"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, PhoneOff, VideoOff } from "lucide-react";

interface MeetingRoomProps {
  meetingId: string;
}

interface JoinMeetingResponse {
  meetingId: string;
  caseId: string;
  scheduledAt: string;
  link: string;
  joinUrl: string;
  join: {
    attendeeId: string;
    expiresAt: string;
  };
}

const prettyDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export function MeetingRoom({ meetingId }: MeetingRoomProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<JoinMeetingResponse | null>(null);

  const fetchMeeting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/video/join?meetingId=${encodeURIComponent(meetingId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? "Unable to load meeting");
      }
      const data = (await res.json()) as JoinMeetingResponse;
      setMeetingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load meeting");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void fetchMeeting();
  }, [fetchMeeting]);

  const handleLeave = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
          <p className="text-sm text-slate-400">Loading secure consultation room…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-center text-white">
        <VideoOff className="h-12 w-12 text-rose-400" />
        <div>
          <p className="text-lg font-semibold text-rose-300">{error}</p>
          <p className="mt-1 text-sm text-slate-400">Check your session and try again.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void fetchMeeting()}
            className="rounded-2xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-2xl border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const joinUrl = meetingData?.joinUrl ?? meetingData?.link ?? "";

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-sm font-semibold text-white">NRI Law Buddy — Secure Consultation</span>
          {meetingData?.scheduledAt && (
            <span className="hidden rounded-full border border-slate-700 px-3 py-0.5 text-xs text-slate-400 md:inline">
              {prettyDateTime(meetingData.scheduledAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-amber-400 hover:text-amber-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </a>
          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Leave
          </button>
        </div>
      </div>

      {/* Jitsi iframe - takes all remaining height */}
      <div className="flex-1 overflow-hidden">
        {joinUrl ? (
          <iframe
            src={joinUrl}
            title="Secure video consultation"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-full w-full border-none"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <p>No meeting link available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
