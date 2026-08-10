import type { Metadata } from "next";
import RegisterClient from "./Client";

export const metadata: Metadata = {
  title: "Create account — x-log",
  description: "Register as an author on this instance",
};

export default function RegisterPage() {
  return <RegisterClient />;
}
