import type { Metadata } from "next";
import LinksClient from "./Client";

export default function LinksPage() {
  return <LinksClient />;
}

export const metadata: Metadata = {
  title: "Links — x-log",
  description: "Your link archive with OGP previews",
};
