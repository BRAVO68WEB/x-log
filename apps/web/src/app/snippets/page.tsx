import type { Metadata } from "next";
import SnippetsClient from "./Client";

export default function SnippetsPage() {
  return <SnippetsClient />;
}

export const metadata: Metadata = {
  title: "Snippets — x-log",
  description: "Your code snippets archive",
};
