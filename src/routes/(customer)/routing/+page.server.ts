import { bookRide } from "$lib/server/booking/bookRide";
import type { Capacities } from "$lib/server/booking/Capacities";
import { db } from "$lib/server/db";
import { readFloat, readInt } from "$lib/server/util/readForm";
import { sql } from "kysely";
import { insertRequest } from "../../api/booking/query";
import { msg, type Msg } from "$lib/msg";
import { fromDate } from "@internationalized/date";

const getCommonTour = (l1: Set<number>, l2: Set<number>) => {
  for (const e of l1) {
    if (l2.has(e)) {
      return e;
    }
  }
  return undefined;
};

export const actions = {
  default: async ({ request, locals }): Promise<Msg> => {
    const customer = locals.session?.userId;
    if (!customer) {
      throw 'not logged in';
    }

    const formData = await request.formData();

    const journeyJson = formData.get('json');
    const startFixed1 = formData.get('startFixed1');
    const startFixed2 = formData.get('startFixed2');
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
      typeof startFixed1 !== 'string' ||
      typeof startFixed2 !== 'string' ||
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
        startFixed1, startFixed2,
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
      start: start1,
      target: target1,
      startTime: startTime1,
      targetTime: targetTime1
    };

    const onlyOne = startFixed1 === startFixed2;
    const connection2 = onlyOne ? null : {
      start: start2,
      target: target2,
      startTime: startTime2,
      targetTime: targetTime2
    };

    let message: Msg | undefined = undefined;
    await db.transaction().execute(async (trx) => {
      await sql`LOCK TABLE tour, request, event, availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);

      let firstBooking = undefined;
      let secondBooking = undefined;
      if (connection1 != null) {
        firstBooking = await bookRide(connection1, capacities, startFixed1 === '1', trx);
        if (firstBooking == undefined) {
          message = msg('nameTooShort');
          return;
        }
      }
      if (connection2 != null) {
        secondBooking = await bookRide(connection2, capacities, startFixed2 === '1', trx);
        if (secondBooking == undefined) {
          message = msg('nameTooShort');
          return;
        }
      }
      if (
        connection1 != null &&
        connection2 != null &&
        firstBooking!.tour != undefined &&
        secondBooking!.tour != undefined
      ) {
        const newTour = getCommonTour(
          firstBooking!.mergeTourList,
          secondBooking!.mergeTourList
        );
        if (newTour != undefined) {
          firstBooking!.tour = newTour;
          secondBooking!.tour = newTour;
        }
      }
      if (connection1 != null) {
        insertRequest(
          firstBooking!.best,
          capacities,
          connection1,
          customer,
          firstBooking!.eventGroupUpdateList,
          [...firstBooking!.mergeTourList],
          firstBooking!.pickupEventGroup,
          firstBooking!.dropoffEventGroup,
          firstBooking!.neighbourIds,
          firstBooking!.directDurations,
          trx
        );
      }
      if (connection2 != null) {
        insertRequest(
          secondBooking!.best,
          capacities,
          connection2,
          customer,
          secondBooking!.eventGroupUpdateList,
          [...secondBooking!.mergeTourList],
          secondBooking!.pickupEventGroup,
          secondBooking!.dropoffEventGroup,
          secondBooking!.neighbourIds,
          secondBooking!.directDurations,
          trx
        );
      }
      message = msg('activationSuccess', 'success');
      return;
    });

    return message!;
  }
};