# Fishing bite schedule

Tidewater authors its time-of-day bite rates in
`experience.behaviors["elsemesh.fishing-game/1"].biteRateSchedule`. Its
owner-signed JavaScript Worker module validates the schedule and compiles it
to a bounded table that the shared browser fishing runtime consumes.

The object contains `defaultMultiplier` and `windows`. The default and each
window multiplier must be between 0.5 and 2. A schedule can contain up to 16
sorted, non-overlapping windows. Each window has `startHour`, `endHour`, and
`multiplier`; hours are from 0 to 24 in 0.1-hour increments. At runtime, the
hour wraps to the 24-hour clock and truncates to its lower tenth before the
half-open range `[startHour, endHour)` is matched. A window includes its start
and excludes its end. Only the bite-wait phase uses this multiplier.

Tidewater uses 1.4 from 05:00 through 08:00 and 17:00 through 20:00, 0.8
before 05:00 and from 22:00 onward, and 1.0 otherwise. The half-open windows
retain the previous behavior's one-tenth-hour boundaries.
