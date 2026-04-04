"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { LoadingButtonContent } from "../../../../components/ui/loading-button-content";
import { THEMES } from "../../../../app/theme";
import { LAYOUTS } from "../../../../app/layoutPreference";
import { useAuth } from "../../../../context/AuthContext";
import { useLayout } from "../../../../context/LayoutContext";
import { useTheme } from "../../../../context/ThemeContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Toast = {
  message: string;
  tone: "success" | "error";
};

export default function AccountDetailsPage() {
  const router = useRouter();
  const { token, user, login, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { layout, setLayout } = useLayout();
  const [toast, setToast] = useState<Toast | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(user?.fullName || "");
  const [profileAddress, setProfileAddress] = useState(user?.address || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveBlockers, setLeaveBlockers] = useState<string[]>([]);
  const [rightRailScrollable, setRightRailScrollable] = useState(false);
  const [rightRailHasMore, setRightRailHasMore] = useState(false);
  const [rightRailScrolled, setRightRailScrolled] = useState(false);
  const rightRailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProfileName(user?.fullName || "");
    setProfileAddress(user?.address || "");
  }, [user?.address, user?.fullName]);

  useEffect(() => {
    const element = rightRailRef.current;
    if (!element) {
      return;
    }

    const syncRailState = () => {
      const canScroll = element.scrollHeight - element.clientHeight > 12;
      const hasMore = element.scrollTop + element.clientHeight < element.scrollHeight - 12;
      const isScrolled = element.scrollTop > 8;

      setRightRailScrollable(canScroll);
      setRightRailHasMore(hasMore);
      setRightRailScrolled(isScrolled);
    };

    syncRailState();
    element.addEventListener("scroll", syncRailState, { passive: true });
    window.addEventListener("resize", syncRailState);

    return () => {
      element.removeEventListener("scroll", syncRailState);
      window.removeEventListener("resize", syncRailState);
    };
  }, []);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2400);
  };

  const saveProfile = async () => {
    if (!token) {
      showToast("You need to log in again", "error");
      return;
    }

    if (!profileName.trim() || !profileAddress.trim()) {
      showToast("Full name and address are required", "error");
      return;
    }

    setBusyAction("profile");
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: profileName,
          address: profileAddress
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      login(token, data.user);
      showToast("Profile updated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update profile", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const updateThemePreference = (value: (typeof THEMES)[number]["id"]) => {
    setTheme(value);
    const activeTheme = THEMES.find((item) => item.id === value);
    showToast(`${activeTheme?.name || "Theme"} applied`, "success");
  };

  const updateLayoutPreference = (value: (typeof LAYOUTS)[number]["id"]) => {
    setLayout(value);
    const active = LAYOUTS.find((item) => item.id === value);
    showToast(`${active?.name || "Layout"} applied`, "success");
  };

  const requestPasswordReset = async () => {
    if (!user?.email) {
      showToast("Account email is unavailable", "error");
      return;
    }

    setBusyAction("reset");
    try {
      const res = await fetch(`${API_URL}/auth/password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reset link");
      }

      showToast("Password reset link sent", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send reset link", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const changePassword = async () => {
    if (!token) {
      showToast("You need to log in again", "error");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Fill in all password fields", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }

    setBusyAction("change-password");
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update password", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const leaveAllOrganizations = async () => {
    if (!token) {
      showToast("You need to log in again", "error");
      return;
    }

    setBusyAction("leave-organizations");
    setLeaveBlockers([]);

    try {
      const res = await fetch(`${API_URL}/auth/leave-organizations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.blockers)) {
          setLeaveBlockers(data.blockers);
        }
        throw new Error(data.error || "Failed to leave organizations");
      }

      setShowLeaveConfirm(false);
      showToast(
        data.left > 0 ? `Left ${data.left} organization${data.left === 1 ? "" : "s"}` : "No organizations to leave",
        "success"
      );
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to leave organizations", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const deleteAccount = async () => {
    if (!token || !user?.email) {
      showToast("You need to log in again", "error");
      return;
    }

    setBusyAction("delete-account");
    try {
      const res = await fetch(`${API_URL}/auth/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: deleteEmail,
          password: deletePassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const blockers =
          data.blockers?.organizations && Array.isArray(data.blockers.organizations)
            ? ` Organizations requiring handoff: ${data.blockers.organizations.join(", ")}.`
            : "";
        throw new Error((data.error || "Failed to delete account") + blockers);
      }

      logout();
      router.push("/");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete account", "error");
    } finally {
      setBusyAction(null);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <main className="tf-page tf-dashboard-page lg:h-screen lg:overflow-hidden">
      <div className="tf-dashboard flex min-h-0 flex-col lg:h-full">
        <header>
          <p className="tf-kicker">Account Details</p>
          <h1 className="tf-title mt-3 text-3xl">Personal account and security</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Manage your personal profile, authentication controls, organization membership, and permanent account actions.
          </p>
        </header>

        <div className="mt-6 grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="min-h-0 space-y-3 xl:h-full xl:overflow-hidden xl:self-start">
            <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm xl:p-5">
              <h2 className="text-lg font-semibold text-text-primary">Edit profile</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Update the personal details used across your workspace and recovery flows.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Email
                  </p>
                  <input
                    className="tf-input mt-2 w-full bg-secondary/25 text-text-secondary"
                    type="email"
                    value={user?.email || ""}
                    readOnly
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Full name
                  </p>
                  <input
                    className="tf-input mt-2 w-full"
                    type="text"
                    placeholder="Full name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Address
                  </p>
                  <textarea
                    className="mt-2 min-h-[80px] w-full rounded-[24px] border border-border bg-card px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    placeholder="Address"
                    value={profileAddress}
                    onChange={(event) => setProfileAddress(event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="tf-button px-4 py-2 text-sm"
                  onClick={saveProfile}
                  disabled={busyAction === "profile"}
                >
                  <LoadingButtonContent
                    loading={busyAction === "profile"}
                    loadingLabel="Saving..."
                    idleLabel="Save changes"
                  />
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm xl:p-5">
              <h2 className="text-lg font-semibold text-text-primary">Change password</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Update your password here without leaving the dashboard.
              </p>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <div className="relative xl:col-span-2">
                  <input
                    className="tf-input w-full pr-12"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    onClick={() => setShowCurrentPassword((current) => !current)}
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="tf-input w-full pr-12"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    onClick={() => setShowNewPassword((current) => !current)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="tf-input w-full pr-12"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? "Hide confirm new password" : "Show confirm new password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="tf-button px-4 py-2 text-sm"
                  onClick={changePassword}
                  disabled={busyAction === "change-password"}
                >
                  <LoadingButtonContent
                    loading={busyAction === "change-password"}
                    loadingLabel="Saving..."
                    idleLabel="Update password"
                  />
                </button>
              </div>
            </section>
          </div>

          <div
            ref={rightRailRef}
            className="tf-scroll-rail relative min-h-0 space-y-5 xl:h-full xl:overflow-y-auto xl:pr-3"
          >
            {rightRailScrollable && (
              <div className="pointer-events-none sticky top-0 z-10 -mb-1 hidden xl:block">
                <div
                  className={`flex items-center justify-between rounded-2xl border border-border/80 bg-card/92 px-4 py-2 shadow-sm backdrop-blur transition ${
                    rightRailScrolled ? "translate-y-0 opacity-100" : "translate-y-0 opacity-95"
                  }`}
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                      More account actions
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Scroll for recovery, organization, and deletion controls.
                    </p>
                  </div>
                  {rightRailHasMore && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                      <ChevronDown className="h-3.5 w-3.5" />
                      Scroll
                    </span>
                  )}
                </div>
              </div>
            )}

            <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm 2xl:p-6">
              <h2 className="text-lg font-semibold text-text-primary">Appearance</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choose a theme and layout that best fits how you monitor production.
              </p>

              <div className="mt-5 grid gap-3">
                {THEMES.map((option) => {
                  const isActive = theme === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateThemePreference(option.id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-primary/35 bg-accent-soft shadow-sm"
                          : "border-border bg-secondary/25 hover:border-primary/20 hover:bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-text-primary">{option.name}</p>
                            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                              {option.mode}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-text-secondary">{option.description}</p>
                        </div>
                        {isActive && (
                          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        {option.swatches.map((swatch) => (
                          <span
                            key={swatch}
                            className="h-5 w-5 rounded-full border border-black/5 shadow-sm"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-border/70 pt-6">
                <p className="text-sm font-semibold text-text-primary">Layout</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Switch between three workspace layouts. Layout changes apply on desktop screens; mobile stays consistent.
                </p>

                <div className="mt-4 grid gap-3">
                  {LAYOUTS.map((option) => {
                    const isActive = layout === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateLayoutPreference(option.id)}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          isActive
                            ? "border-primary/35 bg-accent-soft shadow-sm"
                            : "border-border bg-secondary/25 hover:border-primary/20 hover:bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary">{option.name}</p>
                            <p className="mt-1 text-sm text-text-secondary">{option.description}</p>
                          </div>
                          {isActive && (
                            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
                              Active
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm 2xl:p-6">
              <h2 className="text-lg font-semibold text-text-primary">Recovery</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Send a password reset link or review the rules applied to your account.
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">Password reset link</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Reset links expire after 1 hour and are sent to your account email.
                  </p>
                  <button
                    type="button"
                    className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    onClick={requestPasswordReset}
                    disabled={busyAction === "reset"}
                  >
                    <LoadingButtonContent
                      loading={busyAction === "reset"}
                      loadingLabel="Sending..."
                      idleLabel="Send reset link"
                    />
                  </button>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">Retention policy</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Archived issues, alerts, and projects are permanently removed after 15 days.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-primary/20 bg-primary/10 p-5 shadow-sm 2xl:p-6">
              <h2 className="text-lg font-semibold text-text-primary">Organization membership</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Leave every organization you belong to in one action.
              </p>
              <button
                type="button"
                className="mt-5 rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-primary/10"
                onClick={() => setShowLeaveConfirm(true)}
              >
                Leave all organizations
              </button>
            </section>

            <section className="rounded-2xl border border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.08)] p-5 shadow-sm 2xl:p-6">
              <h2 className="text-lg font-semibold text-text-primary">Danger zone</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Permanently delete your account after confirming your email and password.
              </p>

              <div className="mt-5 grid gap-3">
                <input
                  className="tf-input w-full bg-card"
                  type="email"
                  placeholder="Confirm your email"
                  value={deleteEmail}
                  onChange={(event) => setDeleteEmail(event.target.value)}
                />
                <div className="relative">
                  <input
                    className="tf-input w-full bg-card pr-12"
                    type={showDeletePassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-text-secondary transition hover:bg-secondary/70 hover:text-text-primary"
                    onClick={() => setShowDeletePassword((current) => !current)}
                    aria-label={showDeletePassword ? "Hide confirm your password" : "Show confirm your password"}
                  >
                    {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className="rounded-full border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.12)] px-4 py-2 text-sm font-semibold text-[hsl(var(--destructive))] transition hover:bg-[hsl(var(--destructive)/0.18)]"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!deleteEmail || !deletePassword}
                >
                  Delete account
                </button>
              </div>
            </section>

            {rightRailScrollable && rightRailHasMore && (
              <div className="pointer-events-none sticky bottom-0 hidden xl:block">
                <div className="h-14 rounded-b-[28px] bg-gradient-to-t from-background via-background/92 to-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-lg rounded-[28px] border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Confirm organization leave
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
              Leave all organizations
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This removes your membership from every organization you belong to, unless you are the only owner in one of them.
            </p>

            {!!leaveBlockers.length && (
              <div className="mt-5 rounded-2xl border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.08)] px-4 py-4">
                <p className="text-sm font-medium text-[hsl(var(--destructive))]">
                  These organizations still need another owner before you can leave:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {leaveBlockers.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-[hsl(var(--destructive)/0.24)] bg-card px-3 py-1 text-xs font-semibold text-[hsl(var(--destructive))]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="min-w-[144px] rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/50 hover:text-text-primary"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  setLeaveBlockers([]);
                }}
                disabled={busyAction === "leave-organizations"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-w-[144px] rounded-full border border-primary/25 bg-primary/12 px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-primary/18"
                onClick={leaveAllOrganizations}
                disabled={busyAction === "leave-organizations"}
              >
                <LoadingButtonContent
                  loading={busyAction === "leave-organizations"}
                  loadingLabel="Leaving..."
                  idleLabel="Leave all"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-lg rounded-[28px] border border-border bg-card/95 p-6 shadow-xl backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--destructive))]">
              Confirm deletion
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
              Delete account permanently
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This action cannot be undone. Personal projects will be removed automatically.
              Organization projects are reassigned to another member when possible. Deletion is
              only blocked when an organization has nobody else to hand work off to.
            </p>

            <div className="mt-5 rounded-2xl border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.08)] px-4 py-4">
              <p className="text-sm font-medium text-[hsl(var(--destructive))]">
                Confirm that you want to permanently remove {user?.email || "this account"}.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="min-w-[144px] rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-secondary/50 hover:text-text-primary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={busyAction === "delete-account"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-w-[144px] rounded-full border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.12)] px-4 py-2 text-sm font-semibold text-[hsl(var(--destructive))] transition hover:bg-[hsl(var(--destructive)/0.18)]"
                onClick={deleteAccount}
                disabled={busyAction === "delete-account"}
              >
                <LoadingButtonContent
                  loading={busyAction === "delete-account"}
                  loadingLabel="Deleting..."
                  idleLabel="Delete account"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`tf-dashboard-toast ${
            toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
