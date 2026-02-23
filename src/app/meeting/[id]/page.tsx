import { MeetingRoom } from "@/components/meeting-room";

interface MeetingPageProps {
  params: {
    id: string;
  };
}

export default function MeetingPage({ params }: MeetingPageProps) {
  return <MeetingRoom meetingId={params.id} />;
}
