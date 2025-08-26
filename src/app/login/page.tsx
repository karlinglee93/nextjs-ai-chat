import LoginForm from "@/components/login_form";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <main className="flex items-center justify-center md:h-screen">
      <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
        <div className="flex h-20 w-full rounded-lg bg-blue-500 p-3 md:h-36">
          <div className="flex items-center w-32 text-white md:w-72 text-lg md:text-xl font-semibold">
            NORA: TikTok Sales Assistant
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <div className="text-sm text-red-500 md:text-base">
          <p className="font-medium">Try</p>
          <p>username: admin@tcd.ie</p>
          <p>password: adminadmin</p>
        </div>
      </div>
    </main>
  );
}
