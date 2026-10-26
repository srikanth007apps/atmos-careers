/** Parse YYYY-MM-DD filter values into an inclusive IST day range (Unix ms). */
export function parseDateRange(from?: string | null, to?: string | null) {
  const valid = (v?: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    from: valid(from) ? Date.parse(`${from}T00:00:00.000+05:30`) : null,
    to: valid(to) ? Date.parse(`${to}T23:59:59.999+05:30`) : null,
  };
}
