import type { Metadata } from "next";
import ThreadViewClient from "./Client";

export default function ThreadPage(props: { params: Promise<{ id: string }> }) {
  return <ThreadViewClient params={props.params} />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Thread — x-log",
    description: "View a thread",
  };
}
