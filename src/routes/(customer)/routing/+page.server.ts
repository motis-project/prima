import { bookRide } from "$lib/server/booking/bookRide";
import type { Capacities } from "$lib/server/booking/Capacities";
import { db } from "$lib/server/db";
import { readFloat, readInt } from "$lib/server/util/readForm";
import { sql } from "kysely";
import { insertRequest } from "../../api/booking/query";
import type { BookingError } from "../../debug/proxy+page.server";

export const actions = {
  default: async ({ request, locals }): Promise<BookingError | { vehicle: number }> => {
    const customer = locals.session?.userId;
    if (!customer) {
      throw 'not logged in';
    }

    const formData = await request.formData();

    const fromAddress1 = formData.get('fromAddress1');
    const toAddress1 = formData.get('toAddress1');
    const fromAddress2 = formData.get('fromAddress2');
    const toAddress2 = formData.get('toAddress2');
    const fromLat1 = readFloat(formData.get('fromLat1'));
    const fromLng1 = readFloat(formData.get('fromLng1'));
    const toLat1 = readFloat(formData.get('toLat1'));
    const toLng1 = readFloat(formData.get('toLng1'));
    const fromLat2 = readFloat(formData.get('fromLat2'));
    const fromLng2 = readFloat(formData.get('fromLng2'));
    const toLat2 = readFloat(formData.get('toLat2'));
    const toLng2 = readFloat(formData.get('toLng2'));
    const startTime1 = readInt(formData.get('startTime1'));
    const targetTime1 = readInt(formData.get('targetTime1'));
    const startTime2 = readInt(formData.get('startTime2'));
    const targetTime2 = readInt(formData.get('targetTime2'));

    if (
      typeof fromAddress1 !== 'string' ||
      typeof toAddress1 !== 'string' ||
      typeof fromAddress2 !== 'string' ||
      typeof toAddress2 !== 'string' ||
      isNaN(fromLat1) ||
      isNaN(fromLng1) ||
      isNaN(toLat1) ||
      isNaN(toLng1) ||
      isNaN(startTime1) ||
      isNaN(targetTime1) ||
      isNaN(fromLat2) ||
      isNaN(fromLng2) ||
      isNaN(toLat2) ||
      isNaN(toLng2) ||
      isNaN(startTime2) ||
      isNaN(targetTime2)
    ) {
      console.log('invalid booking params', {
        fromAddress1, toAddress1,
        fromAddress2, toAddress2,
        fromLat1, fromLng1, toLat1, toLng1, startTime1, targetTime1,
        fromLat2, fromLng2, toLat2, toLng2, startTime2, targetTime2
      });
      throw 'invalid booking params';
    }

    const capacities: Capacities = {
      bikes: 0,
      luggage: 0,
      passengers: 1,
      wheelchairs: 0
    };
    const start1 = { lat: fromLat1, lng: fromLng1, address: fromAddress1 };
    const target1 = { lat: toLat1, lng: toLng1, address: toAddress1 };
    const start2 = { lat: fromLat2, lng: fromLng2, address: fromAddress2 };
    const target2 = { lat: toLat2, lng: toLng2, address: toAddress2 };

    const connection1 = {
      start: { lat: fromLat1, lng: fromLng1, address: fromAddress1 },
      target: { lat: toLat1, lng: toLng1, address: toAddress1 },
      startTime: startTime1,
      targetTime: targetTime1
    };
    const connection2 = {
      start: { lat: fromLat2, lng: fromLng2, address: fromAddress2 },
      target: { lat: toLat2, lng: toLng2, address: toAddress2 },
      startTime: startTime2,
      targetTime: targetTime2
    };

    await db.transaction().execute(async (trx) => {
      await sql`LOCK TABLE tour, request, event, availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);
      const booking1 = await bookRide(connection1, capacities, true);
      const booking2 = await bookRide(connection2, capacities, false);
    });


    console.log('booking: ', JSON.stringify(booking, null, '\t'));

    if (booking == undefined) {
      return { msg: 'noVehicle' };
    }

    await db.transaction().execute(async (trx) => {
      await insertRequest(
        booking.best,
        capacities,
        connection,
        customer,
        booking.eventGroupUpdateList,
        [...booking.mergeTourList],
        booking.pickupEventGroup,
        booking.dropoffEventGroup,
        booking.neighbourIds,
        booking.directDurations,
        trx
      );
    });

    return { vehicle: booking.best.vehicle };
  }
};