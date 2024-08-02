import bautzenJson from './bautzen.json';
import { createTrace } from './create_trace';
import { getRoute } from '$lib/api';
import { TZ } from '$lib/constants';


const calculateDistance = (segment: number[][]) => {
    const R = 6371; // Radius of the Earth in kilometers
    const [lon1, lat1] = segment[0];
    const [lon2, lat2] = segment[1];

    // Convert degrees to radians
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
}

const getLines = (route: Route) => {
    let points: [number, number][] = [];
    route.features.forEach((feature: { geometry: { coordinates: [number, number][]; }; }) => {
        points.push(feature.geometry.coordinates[0]);
    });
    let lines: number[][][] = [];
    for (let i = 0; i < points.length - 1; i++) {
        lines.push([points[i], points[i + 1]]);
    };
    return lines;
}

type Route = { features: { geometry: { coordinates: [number, number][]; }; }[]; }

const getRouteSegment = async (start: any, destination: any) => {
    return await getRoute({
        start: {
            lat: start.latitude,
            lng: start.longitude,
            level: 0
        },
        destination: {
            lat: destination.latitude,
            lng: destination.longitude,
            level: 0
        },
        profile: 'car',
        direction: 'forward'
    });
}

const getSegmentFare = async (start: any, dst: any, tarif: number) => {
    let route = await getRouteSegment(start, dst);
    let dist = route.metadata.distance / 1000;
    let duration = route.metadata.duration / 3600;
    let distFare = dist * tarif;
    // let timeFare = duration * bautzenJson['wartezeit-ph'];
    let timeFare = 0; // TODO
    return Math.round(distFare + timeFare);
}

const isInsideComunity = (event: any) => {
    // TODO
    return true;
}

const getCompanyBase = (companyId: number) => {
    // TODO
    return {
        latitude: 51.18813445535576,
        longitude: 14.45274310414274,
    };
}

const isTimestampInRange = (isoTimestampUTC: string, startHour: number, endHour: number) => {
    const timestamp = new Date(isoTimestampUTC); // GMT + 0 on server
    const localDateTime = new Date(timestamp.toLocaleString('en', { timeZone: TZ }));
    return localDateTime.getHours() >= startHour || localDateTime.getHours() < endHour;
}

export const getFareEstimation = async (start: any, destination: any) => {
    let totalFare = bautzenJson['grundpreis'];

    if (!isInsideComunity(start)) {
        // rate for journey to first pickup
        totalFare += await getSegmentFare(getCompanyBase(0), start, bautzenJson['anfahrt-pkm']);
    }

    if (isTimestampInRange(
        start.scheduled_time.toISOString(),
        bautzenJson['beginn-nacht'],
        bautzenJson['ende-nacht']
    )) {
        // nighttime rate
        totalFare += await getSegmentFare(start, destination, bautzenJson['ts3-pkm']);
    } else {
        // daytime rate
        totalFare += await getSegmentFare(start, destination, bautzenJson['ts2-pkm']);
    }

    return totalFare;
}
