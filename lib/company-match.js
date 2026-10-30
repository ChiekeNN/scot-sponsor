// Companies House search is fuzzy. Only present exact names and registered-office
// locations for the selected directory row; never infer an identity from similarity.
const normalise = value => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toUpperCase() : '';

export function matchesSponsor(candidate, sponsor) {
  const name = normalise(candidate?.title);
  const number = normalise(candidate?.company_number);
  const address = candidate?.address;
  const expectedName = normalise(sponsor?.organisation_name);
  const city = normalise(sponsor?.city_town);
  const county = normalise(sponsor?.county_region);
  if (!expectedName || !city || !name || name !== expectedName || !/^[A-Z0-9]{8}$/.test(number) || !address) return false;

  // The snippet can refer to a different indexed address, so use structured
  // registered-office fields only. A substring match (e.g. Perthshire/Perth)
  // is not sufficient evidence for a town match.
  const locality = normalise(address.locality);
  const region = normalise(address.region);
  const addressLine2 = normalise(address.address_line_2);
  const country = normalise(address.country);
  if (locality ? locality !== city : ![region, addressLine2].includes(city)) return false;
  if (['ENGLAND', 'WALES', 'NORTHERN IRELAND'].includes(region)) return false;
  if (country && !['SCOTLAND', 'UNITED KINGDOM', 'UK', 'GREAT BRITAIN', 'GB'].includes(country)) return false;
  const specificCounty = county && county !== 'SCOTLAND';
  if (specificCounty && region !== county) return false;

  // Companies House often omits "Scotland" from the address or uses UK.
  // Scottish company-number prefixes, an explicit country/region, or an exact
  // specific Scottish county corroborate Scotland without guessing from a name.
  const scottish = country === 'SCOTLAND' || region === 'SCOTLAND' || /^(SC|SO|SL|SP|SR)/.test(number) || Boolean(specificCounty && region === county);
  return scottish;
}

export function registeredOffice(address) {
  if (!address) return '';
  return [address.address_line_1, address.address_line_2, address.locality, address.region, address.postal_code, address.country]
    .filter(value => typeof value === 'string' && value.trim()).join(', ');
}
