import { SettingsHeader } from "@/components/settings-header";
import { ProfileView } from "@/components/profile-view";
import { getMyProfile } from "@/lib/actions/profile";

export default async function SettingsPage() {
  const user = await getMyProfile();

  return (
    <>
      <SettingsHeader crumbs={["User", "Profile"]} />
      <ProfileView user={user} />
    </>
  );
}
