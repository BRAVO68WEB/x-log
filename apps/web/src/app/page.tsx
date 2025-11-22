import { PostList } from "@/components/PostList";

export default function Home() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Latest Posts</h1>
        <PostList />
      </div>
    </main>
  );
}

