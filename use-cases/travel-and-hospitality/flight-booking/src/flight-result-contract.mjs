export function assertFlightResultMatchesRequest(result, request) {
  const criteria = result.searchCriteria;
  const expected = {
    origin: request.origin,
    destination: request.destination,
    departureDate: request.departureDate,
    returnDate: request.returnDate,
    passengers: request.passengers,
    tripType: request.tripType,
  };
  for (const [field, value] of Object.entries(expected)) {
    if ((criteria[field] ?? undefined) !== (value ?? undefined)) {
      throw new Error(`Flight results do not match requested ${field}`);
    }
  }

  for (const flight of result.outboundFlights) {
    if (
      flight.departureAirport !== request.origin ||
      flight.arrivalAirport !== request.destination
    ) {
      throw new Error(
        "Outbound flight route does not match the requested route",
      );
    }
  }
  const returnFlights = result.returnFlights ?? [];
  for (const flight of returnFlights) {
    if (
      flight.departureAirport !== request.destination ||
      flight.arrivalAirport !== request.origin
    ) {
      throw new Error("Return flight route does not match the requested route");
    }
  }
  const observedCount = result.outboundFlights.length + returnFlights.length;
  if (result.totalResults !== observedCount) {
    throw new Error(
      `Flight result count ${result.totalResults} contradicts ${observedCount} observed flights`,
    );
  }
  return result;
}
