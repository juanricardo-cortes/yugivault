"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string;
}

export function useSubscription() {
  const [active, setActive] = useState<boolean | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setActive(false);
      return;
    }

    // Admin bypass
    if (session.user.email === "cortes.ricardo1@gmail.com") {
      setActive(true);
      return;
    }

    try {
      const res = await fetch("/api/subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();

      if (data.active) {
        setActive(true);
        setSubscription(data.subscription);
        return;
      }

      // Check 3-day trial based on account creation
      const createdAt = new Date(session.user.created_at);
      const trialEnd = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < trialEnd) {
        const msLeft = trialEnd.getTime() - now.getTime();
        setTrialDaysLeft(Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
        setIsTrial(true);
        setActive(true);
      } else {
        setActive(false);
      }
    } catch {
      setActive(false);
    }
  };

  return { active, subscription, isTrial, trialDaysLeft, refresh: checkSubscription };
}
