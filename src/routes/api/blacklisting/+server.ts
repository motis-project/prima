import { json } from "@sveltejs/kit";
import { getViableBusStops } from "./viableBusStops";


export const POST = async (event) => {
	const {userChosen, busStops,startFixed,capacities} = await event.request.json();
	return json(
		{
			body: JSON.stringify(getViableBusStops(userChosen, busStops, startFixed, capacities))
		},
		{ status: 200 }
	);
}
