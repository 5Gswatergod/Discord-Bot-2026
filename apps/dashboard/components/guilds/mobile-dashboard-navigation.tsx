"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { ManageableGuild } from "@/lib/discord";

import {
  dashboardNavigationGroups,
  dashboardNavigationItems
} from "./guild-dashboard-navigation";

type MobileDashboardNavigationProps = {
  guild: ManageableGuild;
};

const dialogTransitionMs = 220;

function getInitialActiveHref() {
  if (typeof window === "undefined") {
    return "#overview";
  }

  const hash = window.location.hash;
  return dashboardNavigationItems.some((item) => item.href === hash) ? hash : "#overview";
}

export function MobileDashboardNavigation({ guild }: MobileDashboardNavigationProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#overview");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement>(null);
  const closeTimerRef = useRef<number>();
  const previousRootOverflowRef = useRef("");

  const closeMenu = useCallback((restoreFocus = true, afterClose?: () => void) => {
    window.clearTimeout(closeTimerRef.current);
    setIsOpen(false);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimerRef.current = window.setTimeout(
      () => {
        setIsMounted(false);
        document.documentElement.style.overflow = previousRootOverflowRef.current;
        afterClose?.();
        if (restoreFocus) {
          triggerRef.current?.focus({ preventScroll: true });
        }
      },
      reduceMotion ? 0 : dialogTransitionMs
    );
  }, []);

  function openMenu() {
    window.clearTimeout(closeTimerRef.current);
    setIsMounted(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsOpen(true));
    });
  }

  useEffect(() => {
    const initialHref = getInitialActiveHref();
    setActiveHref(initialHref);

    const sections = dashboardNavigationItems
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));
    let scrollFrame: number | undefined;

    const updateActiveSection = () => {
      window.cancelAnimationFrame(scrollFrame ?? 0);
      scrollFrame = window.requestAnimationFrame(() => {
        const marker = 128;
        let currentSection: HTMLElement | undefined = sections[0];

        for (const section of sections) {
          if (section.getBoundingClientRect().top <= marker) {
            currentSection = section;
          } else {
            break;
          }
        }

        if (
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2
        ) {
          currentSection = sections.at(-1);
        }

        if (currentSection) {
          setActiveHref(`#${currentSection.id}`);
        }
      });
    };

    const initialScrollTimer = window.setTimeout(() => {
      if (window.location.hash === initialHref && initialHref !== "#overview") {
        document.getElementById(initialHref.slice(1))?.scrollIntoView({ block: "start" });
      }
      updateActiveSection();
    }, 0);

    const syncHash = () => {
      const nextHref = getInitialActiveHref();
      setActiveHref(nextHref);
    };
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);

    return () => {
      window.clearTimeout(initialScrollTimer);
      window.cancelAnimationFrame(scrollFrame ?? 0);
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeMenu(false);
      }
    };

    desktopViewport.addEventListener("change", closeOnDesktop);
    return () => desktopViewport.removeEventListener("change", closeOnDesktop);
  }, [closeMenu, isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const previousOverflow = document.documentElement.style.overflow;
    previousRootOverflowRef.current = previousOverflow;
    document.documentElement.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const activeItem = activeItemRef.current;
      const scrollContainer = scrollContainerRef.current;

      if (activeItem && scrollContainer) {
        const activeRect = activeItem.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        scrollContainer.scrollTop +=
          activeRect.top -
          containerRect.top -
          (containerRect.height - activeRect.height) / 2;
      }

      dialogRef.current?.focus({ preventScroll: true });
    }, isOpen ? dialogTransitionMs : 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        return;
      }

      if (document.activeElement === dialogRef.current) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isMounted, isOpen]);

  function navigateToSection(href: string) {
    const section = document.getElementById(href.slice(1));
    setActiveHref(href);

    if (!section) {
      closeMenu(false);
      return;
    }

    window.history.pushState(null, "", href);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeMenu(
      false,
      () =>
        section.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start"
        })
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        onClick={openMenu}
        aria-label="開啟功能選單"
        aria-expanded={isOpen}
        aria-controls="mobile-dashboard-navigation"
      >
        <Menu size={22} aria-hidden="true" />
      </button>

      {isMounted
        ? createPortal(
            <div
              id="mobile-dashboard-navigation"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Hydrava 功能選單"
              tabIndex={-1}
              className={cn(
                "fixed inset-0 z-[60] flex flex-col bg-background transition duration-200 ease-out lg:hidden",
                isOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
              )}
            >
              <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border/80 px-4 sm:px-6">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => closeMenu()}
                  aria-label="關閉功能選單"
                >
                  <X size={22} aria-hidden="true" />
                </button>
                <Link
                  href="/guilds"
                  className="flex items-center gap-2 text-lg font-extrabold tracking-[0.1em]"
                  onClick={() => closeMenu(false)}
                >
                  <Image
                    src="/brand/hydrava-avatar.png"
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                    priority
                  />
                  HYDRAVA
                </Link>
                <ThemeToggle />
              </div>

              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-5 sm:px-6"
                style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
              >
                <Link
                  href="/guilds"
                  className="mb-7 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-panel transition-colors hover:bg-muted"
                  onClick={() => closeMenu(false)}
                >
                  <MobileGuildIcon guild={guild} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{guild.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      切換伺服器
                    </span>
                  </span>
                  <ChevronRight className="text-muted-foreground" size={18} aria-hidden="true" />
                </Link>

                <nav className="space-y-7" aria-label="伺服器設定">
                  {dashboardNavigationGroups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeHref === item.href;

                          return (
                            <a
                              key={item.href}
                              ref={isActive ? activeItemRef : undefined}
                              href={item.href}
                              className={cn(
                                "flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                                isActive
                                  ? "bg-primary/12 font-semibold text-primary"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                              onClick={(event) => {
                                event.preventDefault();
                                navigateToSection(item.href);
                              }}
                              aria-current={isActive ? "location" : undefined}
                            >
                              <span
                                className={cn(
                                  "h-2 w-2 shrink-0 rounded-full",
                                  isActive ? "bg-primary" : "bg-border"
                                )}
                                aria-hidden="true"
                              />
                              <Icon size={19} aria-hidden="true" />
                              <span>{item.label}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function MobileGuildIcon({ guild }: { guild: ManageableGuild }) {
  if (guild.iconUrl) {
    return (
      <Image
        src={guild.iconUrl}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-xl bg-muted object-cover"
        unoptimized={guild.iconUrl.includes(".gif")}
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-bold text-primary">
      {guild.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
