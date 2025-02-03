import { Validator } from 'jsonschema';
import { getViableBusStops, type BlacklistingResult } from './viableBusStops';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import { schemaDefinitions, whitelistSchema } from '../whitelist/WhitelistRequest';
import { type WhitelistRequest as BlacklistRequest } from '../whitelist/WhitelistRequest';
import type { BusStop } from '../whitelist/WhitelistRequest';

export const POST = async (event: RequestEvent) => {
  const p = await event.request.json();
  const validator = new Validator();
  validator.addSchema(schemaDefinitions, '/schemaDefinitions');
  const result = validator.validate(p, whitelistSchema);
  if (!result.valid) {
    return json(
      {
        message: result.errors
      },
      { status: 400 }
    );
  }
  const parameters: BlacklistParameters = toBlacklistParameters(p);
  const directAsBusStop = {
    coordinates: parameters.startFixed ? parameters.start : parameters.target,
    times: parameters.times
  };
  if (parameters.startFixed) {
    parameters.targetBusStops.push(directAsBusStop);
  } else {
    parameters.startBusStops.push(directAsBusStop);
  }
  const start = await getViableBusStops(
    parameters.start,
    parameters.startBusStops,
    false,
    parameters.capacities
  );
  const target = await getViableBusStops(
    parameters.target,
    parameters.targetBusStops,
    true,
    parameters.capacities
  );
  const createResponse = (allowedConnections: BlacklistingResult[], busStops: BusStop[]) => {
    const response = new Array<boolean[]>(busStops.length);
    for (let i = 0; i != response.length; ++i) {
      response[i] = new Array<boolean>(busStops[i].times.length);
      for (let j = 0; j != response[i].length; ++j) {
        response[i][j] = false;
      }
    }
    allowedConnections.forEach((s) => {
      response[s.busstopindex][s.timeIndex] = true;
    });
    return response;
  };

  let startResponse = createResponse(start, parameters.startBusStops);
  let targetResponse = createResponse(target, parameters.targetBusStops);
  const directResponse = parameters.startFixed
    ? targetResponse[targetResponse.length - 1]
    : startResponse[startResponse.length - 1];
  if (parameters.startFixed) {
    targetResponse = targetResponse.slice(0, targetResponse.length - 1);
  } else {
    startResponse = startResponse.slice(0, startResponse.length - 1);
  }

  const response = {
    start: startResponse,
    target: targetResponse,
    direct: directResponse
  };
  return json(response);
};
