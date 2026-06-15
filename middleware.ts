import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

async function getOnboardingState(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<{ completed: boolean; defaultProjectId: string | null }> {
  const { data } = await supabase
    .from("user_settings")
    .select("onboarding_completed, default_project_id")
    .eq("owner_id", userId)
    .maybeSingle();

  return {
    completed: Boolean(data?.onboarding_completed),
    defaultProjectId: data?.default_project_id ?? null,
  };
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        req.cookies.set({ name, value, ...options });
        res = NextResponse.next({ request: { headers: req.headers } });
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        req.cookies.set({ name, value: "", ...options });
        res = NextResponse.next({ request: { headers: req.headers } });
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const isApp =
    pathname.startsWith("/projects") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/debug") ||
    pathname.startsWith("/onboarding");
  const isAuthPage = pathname.startsWith("/auth");
  const isOnboarding = pathname.startsWith("/onboarding");

  if (!user && isApp) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isApp) {
    const onboarding = await getOnboardingState(supabase, user.id);

    if (!onboarding.completed && !isOnboarding) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (onboarding.completed && isOnboarding) {
      const url = req.nextUrl.clone();
      url.pathname = onboarding.defaultProjectId
        ? `/projects/${onboarding.defaultProjectId}`
        : "/projects";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && isAuthPage && !pathname.startsWith("/auth/sign-out") && !pathname.startsWith("/auth/callback")) {
    const onboarding = await getOnboardingState(supabase, user.id);
    const url = req.nextUrl.clone();
    url.pathname = onboarding.completed ? "/projects" : "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
