import type { Metadata } from "next";
import { UserDetailView } from "@/components/admin/users-view";

export const metadata: Metadata = { title: "Admin · User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailView id={id} />;
}
