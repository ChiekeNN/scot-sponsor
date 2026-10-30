/** Build a link to the user's own Work Hub search; no vacancy data is copied. */
export function workHubSearchUrl(keywords = '', sponsorship = false): string {
  const terms = keywords.trim().slice(0, 100);
  const query = [terms, sponsorship ? 'visa sponsorship' : ''].filter(Boolean).join(' ');
  const params = new URLSearchParams({keywords: query, locationId: 'country-scotland', location: 'Scotland, Scotland'});
  return `https://www.jobs.service.gov.uk/jobs/search?${params}`;
}
