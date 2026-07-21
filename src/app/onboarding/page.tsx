import { redirect } from "next/navigation";
import { requireWorkspace, hasCompletedOnboarding } from "@/lib/workspace";
import { completeOwnerOnboarding, completeMemberOnboarding } from "@/lib/actions/onboarding";

const INDUSTRY_OPTIONS = ["Software / SaaS", "Finance", "Healthcare", "Retail", "Real Estate", "Other"];
const SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-500", "500+"];

export default async function OnboardingPage() {
  const { userId, role } = await requireWorkspace();
  if (await hasCompletedOnboarding(userId)) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm px-8 py-10 border border-border rounded-lg">
        {role === "owner" ? <OwnerForm /> : <MemberForm />}
      </div>
    </div>
  );
}

function OwnerForm() {
  return (
    <>
      <h1 className="text-xl font-medium mb-1">Set up your workspace</h1>
      <p className="text-[13px] text-subtle mb-8">This is what your team will see.</p>

      <form
        action={async (formData) => {
          "use server";
          await completeOwnerOnboarding({
            name: String(formData.get("name") ?? ""),
            industry: String(formData.get("industry") ?? ""),
            size: String(formData.get("size") ?? ""),
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5 text-[13px]">
          Workspace name
          <input
            name="name"
            required
            placeholder="Acme Inc."
            className="w-full px-3 py-2 rounded-md border border-border bg-transparent outline-none focus:border-accent transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px]">
          Industry
          <select
            name="industry"
            defaultValue=""
            className="w-full px-3 py-2 rounded-md border border-border bg-transparent outline-none focus:border-accent transition-colors"
          >
            <option value="" disabled>
              Select an industry
            </option>
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px]">
          Team size
          <select
            name="size"
            defaultValue=""
            className="w-full px-3 py-2 rounded-md border border-border bg-transparent outline-none focus:border-accent transition-colors"
          >
            <option value="" disabled>
              Select a team size
            </option>
            {SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="w-full mt-2 py-2.5 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Continue
        </button>
      </form>
    </>
  );
}

function MemberForm() {
  return (
    <>
      <h1 className="text-xl font-medium mb-1">Welcome</h1>
      <p className="text-[13px] text-subtle mb-8">Tell your team a bit about yourself.</p>

      <form
        action={async (formData) => {
          "use server";
          await completeMemberOnboarding({
            firstName: String(formData.get("firstName") ?? ""),
            lastName: String(formData.get("lastName") ?? ""),
            title: String(formData.get("title") ?? ""),
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5 text-[13px]">
          First name
          <input
            name="firstName"
            required
            placeholder="Jane"
            className="w-full px-3 py-2 rounded-md border border-border bg-transparent outline-none focus:border-accent transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px]">
          Last name
          <input
            name="lastName"
            placeholder="Doe"
            className="w-full px-3 py-2 rounded-md border border-border bg-transparent outline-none focus:border-accent transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px]">
          Title / role
          <input
            name="title"
            placeholder="Account Executive"
            className="w-full px-3 py-2 rounded-md border border-border bg-transparent outline-none focus:border-accent transition-colors"
          />
        </label>

        <button
          type="submit"
          className="w-full mt-2 py-2.5 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Continue
        </button>
      </form>
    </>
  );
}
