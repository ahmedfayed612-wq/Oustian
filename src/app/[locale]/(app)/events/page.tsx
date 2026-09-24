import { CalendarDays, MapPin, Plus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireApprovedMember } from "@/features/auth/session";
import { listUpcomingEvents } from "@/features/events/queries";
import { RsvpButton } from "@/features/events/rsvp-button";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getTranslations("Events");

  return { title: t("metaTitle") };
}

/**
 * Upcoming campus events, soonest first. Cards render server-side; only the
 * RSVP toggle is a client component (it owns the optimistic count).
 */
export default async function EventsPage() {
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Events");
  const format = await getFormatter();

  const supabase = await createClient();
  const events = await listUpcomingEvents(supabase, viewer.id);

  const createLink = (
    <Link
      href="/events/create"
      className={buttonClasses({ variant: "primary", size: "sm" })}
    >
      <Plus className="size-4" aria-hidden="true" />
      {t("create")}
    </Link>
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={createLink}
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6" aria-hidden="true" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={createLink}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(({ event, goingCount, myRsvp }) => (
            <Card key={event.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-brand">
                    {format.dateTime(new Date(event.starts_at), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>

                  <h2 className="mt-1 text-base font-bold text-text">
                    {event.title}
                  </h2>

                  {event.location ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      <span dir="auto">{event.location}</span>
                    </p>
                  ) : null}

                  {event.ends_at ? (
                    <p className="mt-1 text-xs text-muted">
                      {t("until", {
                        end: format.dateTime(new Date(event.ends_at), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                      })}
                    </p>
                  ) : null}

                  {event.description ? (
                    <p
                      className="mt-2 text-sm leading-relaxed text-text"
                      dir="auto"
                    >
                      {event.description}
                    </p>
                  ) : null}
                </div>

                <RsvpButton
                  eventId={event.id}
                  meId={viewer.id}
                  initialCount={goingCount}
                  initialGoing={myRsvp}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
