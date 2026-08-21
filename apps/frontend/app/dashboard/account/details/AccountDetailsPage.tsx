"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, EyeOff, Trash2, X } from "lucide-react";
import { LoadingButtonContent } from "../../../../components/ui/loading-button-content";
import { THEMES } from "../../../../app/theme";
import { LAYOUTS } from "../../../../app/layoutPreference";
import { useAuth } from "../../../../context/AuthContext";
import { useLayout } from "../../../../context/LayoutContext";
import { useTheme } from "../../../../context/ThemeContext";
import { PageDescriptionPopover } from "@/components/ui/page-description-popover";

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
  const [showProDeleteConfirm, setShowProDeleteConfirm] = useState(false);
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
      setShowProDeleteConfirm(false);
    }
  };

  const continueDeleteAccount = () => {
    if (user?.plan === "PRO") {
      setShowDeleteConfirm(false);
      setShowProDeleteConfirm(true);
      return;
    }

    void deleteAccount();
  };

  return (
    <main className="tf-page tf-dashboard-page xl:h-screen xl:overflow-hidden">
      <div className="tf-dashboard flex flex-col xl:h-full">
        <header>
          <p className="tf-kicker">Account Details</p>
          <div className="mt-3 flex items-center">
            <h1 className="text-3xl font-bold text-text-primary">Personal account and security</h1>
            <PageDescriptionPopover>
              Manage your personal profile, authentication controls, organization membership, and permanent account actions.
            </PageDescriptionPopover>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-3 xl:min-h-0 xl:self-start xl:overflow-hidden">
            <section className="rounded-[24px] border border-border/40 bg-card p-6 shadow-sm">
              <h2 className="text-xl font-bold text-text-primary">Edit profile</h2>
              <p className="mt-1.5 text-[14px] text-text-secondary">
                Update the personal details used across your workspace and recovery flows.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Email
                  </p>
                  <input
                    className="w-full appearance-none rounded-sm bg-secondary/10 border border-border/40 text-[14px] font-medium px-4 py-2.5 text-text-secondary cursor-not-allowed outline-none shadow-sm transition-all"
                    type="email"
                    value={user?.email || ""}
                    readOnly
                  />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Full name
                  </p>
                  <input
                    className="w-full appearance-none rounded-sm bg-card border border-border/40 text-[14px] font-medium px-4 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm transition-all"
                    type="text"
                    placeholder="Full name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Address
                  </p>
                  <textarea
                    className="w-full min-h-[80px] appearance-none rounded-[16px] bg-card border border-border/40 text-[14px] font-medium px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm transition-all resize-y"
                    placeholder="Address"
                    value={profileAddress}
                    onChange={(event) => setProfileAddress(event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="rounded-sm bg-primary hover:bg-primary-hover px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors w-full sm:w-auto"
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

            <section className="rounded-[24px] border border-border/40 bg-card p-6 shadow-sm">
              <h2 className="text-xl font-bold text-text-primary">Change password</h2>
              <p className="mt-1.5 text-[14px] text-text-secondary">
                Update your password here without leaving the dashboard.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="relative md:col-span-2">
                  <input
                    className="w-full appearance-none rounded-sm bg-card border border-border/40 text-[14px] font-medium px-4 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm transition-all pr-12"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm p-1.5 text-text-secondary transition hover:bg-secondary/20 hover:text-text-primary"
                    onClick={() => setShowCurrentPassword((current) => !current)}
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="w-full appearance-none rounded-sm bg-card border border-border/40 text-[14px] font-medium px-4 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm transition-all pr-12"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm p-1.5 text-text-secondary transition hover:bg-secondary/20 hover:text-text-primary"
                    onClick={() => setShowNewPassword((current) => !current)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="w-full appearance-none rounded-sm bg-card border border-border/40 text-[14px] font-medium px-4 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-sm transition-all pr-12"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm p-1.5 text-text-secondary transition hover:bg-secondary/20 hover:text-text-primary"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? "Hide confirm new password" : "Show confirm new password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="rounded-sm bg-primary hover:bg-primary-hover px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors w-full sm:w-auto"
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
            className="tf-scroll-rail relative space-y-5 xl:min-h-0 xl:overflow-y-auto xl:pr-3"
          >
            {rightRailScrollable && (
              <div className="pointer-events-none sticky top-0 z-10 -mb-1 hidden xl:block">
                <div
                  className={`flex items-center justify-between rounded-[24px] border border-border/80 bg-card/92 px-4 py-2 shadow-sm backdrop-blur transition ${
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

            <section className="rounded-[24px] border border-border/40 bg-card p-6 shadow-sm">
              <h2 className="text-xl font-bold text-text-primary">Appearance</h2>
              <p className="mt-1.5 text-[14px] text-text-secondary">
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
                      className={`rounded-[16px] border px-4 py-4 text-left transition-colors ${
                        isActive
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border/40 bg-secondary/10 hover:border-primary/30 hover:bg-secondary/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-bold text-text-primary">{option.name}</p>
                            <span className="rounded-[4px] border border-border/50 bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary shadow-sm">
                              {option.mode}
                            </span>
                          </div>
                          <p className="mt-1 text-[14px] text-text-secondary leading-relaxed">{option.description}</p>
                        </div>
                        {isActive && (
                          <span className="rounded-[4px] bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
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

              <div className="mt-6 border-t border-border/40 pt-6">
                <p className="text-[15px] font-bold text-text-primary">Layout</p>
                <p className="mt-1.5 text-[14px] text-text-secondary">
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
                        className={`rounded-[16px] border px-4 py-4 text-left transition-colors ${
                          isActive
                            ? "border-primary/50 bg-primary/5 shadow-sm"
                            : "border-border/40 bg-secondary/10 hover:border-primary/30 hover:bg-secondary/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[15px] font-bold text-text-primary">{option.name}</p>
                            <p className="mt-1.5 text-[14px] text-text-secondary leading-relaxed">{option.description}</p>
                          </div>
                          {isActive && (
                            <span className="rounded-[4px] bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
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

            <section className="rounded-[24px] border border-border/40 bg-card p-6 shadow-sm">
              <h2 className="text-xl font-bold text-text-primary">Recovery</h2>
              <p className="mt-1.5 text-[14px] text-text-secondary">
                Send a password reset link or review the rules applied to your account.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-[16px] border border-border/40 bg-secondary/10 px-5 py-5 shadow-inner">
                  <p className="text-[15px] font-bold text-text-primary">Password reset link</p>
                  <p className="mt-1.5 text-[14px] text-text-secondary">
                    Reset links expire after 1 hour and are sent to your account email.
                  </p>
                  <button
                    type="button"
                    className="mt-5 rounded-sm bg-secondary/30 hover:bg-secondary/50 px-5 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors w-full sm:w-auto"
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
                <div className="rounded-[16px] border border-border/40 bg-secondary/10 px-5 py-5 shadow-inner">
                  <p className="text-[15px] font-bold text-text-primary">Retention policy</p>
                  <p className="mt-1.5 text-[14px] text-text-secondary">
                    Archived issues, alerts, and projects are permanently removed after 15 days.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-primary/20 bg-primary/5 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-text-primary">Organization membership</h2>
              <p className="mt-1.5 text-[14px] text-text-secondary">
                Leave every organization you belong to in one action.
              </p>
              <button
                type="button"
                className="mt-5 rounded-sm bg-secondary/30 border border-primary/20 hover:bg-primary/10 px-5 py-2.5 text-sm font-semibold text-text-primary shadow-sm transition-colors w-full sm:w-auto"
                onClick={() => setShowLeaveConfirm(true)}
              >
                Leave all organizations
              </button>
            </section>

            <section className="rounded-[24px] border border-[hsl(var(--destructive)/0.2)] bg-[hsl(var(--destructive)/0.05)] p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(var(--destructive)/0.1)] blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <h2 className="text-xl font-bold text-text-primary">Danger zone</h2>
              <p className="mt-1.5 text-[14px] text-text-secondary">
                Permanently delete your account after confirming your email and password.
              </p>

              <div className="mt-6 grid gap-4">
                <input
                  className="w-full appearance-none rounded-sm bg-card border border-border/40 text-[14px] font-medium px-4 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-[hsl(var(--destructive)/0.2)] focus:border-[hsl(var(--destructive)/0.5)] shadow-sm transition-all"
                  type="email"
                  placeholder="Confirm your email"
                  value={deleteEmail}
                  onChange={(event) => setDeleteEmail(event.target.value)}
                />
                <div className="relative">
                  <input
                    className="w-full appearance-none rounded-sm bg-card border border-border/40 text-[14px] font-medium px-4 py-2.5 text-text-primary outline-none focus:ring-2 focus:ring-[hsl(var(--destructive)/0.2)] focus:border-[hsl(var(--destructive)/0.5)] shadow-sm transition-all pr-12"
                    type={showDeletePassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm p-1.5 text-text-secondary transition hover:bg-secondary/20 hover:text-text-primary"
                    onClick={() => setShowDeletePassword((current) => !current)}
                    aria-label={showDeletePassword ? "Hide confirm your password" : "Show confirm your password"}
                  >
                    {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end relative z-10">
                <button
                  type="button"
                  className="rounded-sm bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 px-5 py-2.5 text-sm font-semibold text-destructive shadow-sm transition-colors w-full sm:w-auto"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-[24px] border border-border/40 bg-card shadow-2xl flex flex-col overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between p-6 pb-2">
              <h3 className="text-[15px] font-bold text-text-primary">Leave Organizations</h3>
              <button onClick={() => {
                  setShowLeaveConfirm(false);
                  setLeaveBlockers([]);
                }} className="rounded-full p-1.5 text-text-secondary hover:bg-secondary/20 hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 pt-2">
               <h4 className="text-xl font-bold text-text-primary mb-2">Leave all organizations</h4>
               <p className="text-[14px] text-text-secondary mb-4">
                 This removes your membership from every organization you belong to, unless you are the only owner in one of them.
               </p>

               {!!leaveBlockers.length && (
                 <div className="rounded-[16px] border border-destructive/20 bg-destructive/5 px-4 py-4">
                   <p className="text-[14px] font-bold text-destructive">
                     These organizations still need another owner before you can leave:
                   </p>
                   <div className="mt-3 flex flex-wrap gap-2">
                     {leaveBlockers.map((name) => (
                       <span
                         key={name}
                         className="rounded-[4px] border border-destructive/20 bg-card px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-destructive shadow-sm"
                       >
                         {name}
                       </span>
                     ))}
                   </div>
                 </div>
               )}
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={leaveAllOrganizations} 
                 disabled={busyAction === "leave-organizations"}
                 className="rounded-sm bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-semibold py-2.5 px-5 transition-colors flex items-center justify-center text-sm flex-1 shadow-sm"
               >
                 <LoadingButtonContent
                   loading={busyAction === "leave-organizations"}
                   loadingLabel="Leaving..."
                   idleLabel="Leave all"
                 />
               </button>
               <button 
                 onClick={() => {
                   setShowLeaveConfirm(false);
                   setLeaveBlockers([]);
                 }} 
                 disabled={busyAction === "leave-organizations"}
                 className="rounded-sm bg-secondary/30 hover:bg-secondary/50 disabled:opacity-50 text-text-primary font-semibold py-2.5 px-5 transition-colors flex items-center justify-center text-sm flex-1 shadow-sm"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-[24px] border border-destructive/20 bg-card shadow-2xl flex flex-col overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between p-6 pb-2">
              <h3 className="text-[15px] font-bold text-text-primary">Delete Account</h3>
              <button onClick={() => setShowDeleteConfirm(false)} className="rounded-full p-1.5 text-text-secondary hover:bg-secondary/20 hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 pt-2">
               <h4 className="text-xl font-bold text-text-primary mb-2">Are you sure you want to delete your account?</h4>
               <p className="text-[14px] text-text-secondary">This action is permanent and cannot be undone.</p>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={continueDeleteAccount} 
                 disabled={busyAction === "delete-account"}
                 className="rounded-sm bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 disabled:opacity-50 font-semibold py-2.5 px-5 transition-all flex items-center justify-center text-sm flex-1 shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 {user?.plan === "PRO" ? "Continue" : "Delete"}
               </button>
               <button 
                 onClick={() => setShowDeleteConfirm(false)} 
                 disabled={busyAction === "delete-account"}
                 className="rounded-sm bg-secondary/30 hover:bg-secondary/50 disabled:opacity-50 text-text-primary font-semibold py-2.5 px-5 transition-colors flex items-center justify-center text-sm flex-1 shadow-sm"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {showProDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-[24px] border border-destructive/20 bg-card shadow-2xl flex flex-col overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between p-6 pb-2">
              <h3 className="text-[15px] font-bold text-text-primary">Delete Pro Account</h3>
              <button onClick={() => setShowProDeleteConfirm(false)} className="rounded-full p-1.5 text-text-secondary hover:bg-secondary/20 hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 pt-2">
               <h4 className="text-xl font-bold text-text-primary mb-2">Are you sure you want to delete your Pro account?</h4>
               <p className="text-[14px] text-text-secondary">Your Pro plan will be immediately disabled without refund. This action is permanent and cannot be undone.</p>
            </div>
            
            <div className="flex flex-row-reverse items-center gap-3 p-6 pt-0">
               <button 
                 onClick={deleteAccount} 
                 disabled={busyAction === "delete-account"}
                 className="rounded-sm bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 disabled:opacity-50 font-semibold py-2.5 px-5 transition-all flex items-center justify-center text-sm flex-1 shadow-[0_8px_16px_-6px_rgba(var(--destructive-rgb),0.1)]"
               >
                 Delete
               </button>
               <button 
                 onClick={() => setShowProDeleteConfirm(false)} 
                 disabled={busyAction === "delete-account"}
                 className="rounded-sm bg-secondary/30 hover:bg-secondary/50 disabled:opacity-50 text-text-primary font-semibold py-2.5 px-5 transition-colors flex items-center justify-center text-sm flex-1 shadow-sm"
               >
                 Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`tf-dashboard-toast animate-fade-up ${
            toast.tone === "success"
              ? "bg-[hsl(var(--success))] text-white"
              : "bg-[hsl(var(--destructive))] text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
