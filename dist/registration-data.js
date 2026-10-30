export function registrationPayload(values) {
  const text = key => String(values[key] ?? '').trim();
  const hasTeam = values.hasTeam === 'yes';
  const needsTransportation = values.needsTransportation === 'yes';
  return {
    edition: 'ARENA 26',
    fullName: text('fullName'), phoneNumber: text('phoneNumber'), email: text('email'),
    discordTag: text('discordTag'), university: text('university'), yearOfStudy: text('yearOfStudy'), studentId: text('studentId'),
    hasTeam, teamName: hasTeam ? text('teamName') : '',
    teammates: hasTeam ? ['teammate1', 'teammate2', 'teammate3'].map(text).filter(Boolean) : [],
    needsTransportation, transportationAddress: needsTransportation ? text('transportationAddress') : '',
    expectations: text('expectations')
  };
}
