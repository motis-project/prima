import { bookRide, toExpectedConnectionWithISOStrings } from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/util/booking/Capacities';
import { db } from '$lib/server/db';
import { readFloat, readInt } from '$lib/server/util/readForm';
import { sql } from 'kysely';
import { insertRequest } from '../../api/booking/query';
import { msg, type Msg } from '$lib/msg';
import { redirect } from '@sveltejs/kit';
import { sendMail } from '$lib/server/sendMail';
import NewRide from '$lib/server/email/NewRide.svelte';
import type { PageServerLoadEvent } from './$types';
import { isSamePlace } from '$lib/util/booking/isSamePlace';
import { DAY } from '$lib/util/time';

export async function load(event: PageServerLoadEvent) {
	const userId = event.locals.session?.userId;
	if (!userId) {
		return {
			favouriteLocations: [],
			favouriteRoutes: []
		};
	}
	return {
		favouriteLocations: await db
			.with('top_favourites', (qb) =>
				qb
					.selectFrom('favouriteLocations')
					.select((eb) => [
						eb.lit(1).$castTo<number>().as('sort_order'),
						'address',
						'lat',
						'lng',
						'level',
						'count',
						'id'
					])
					.where('user', '=', userId)
					.orderBy('count', 'desc')
					.limit(5)
			)
			.with('latest', (qb) =>
				qb
					.selectFrom('favouriteLocations')
					.select((eb) => [
						eb.lit(2).$castTo<number>().as('sort_order'),
						'address',
						'lat',
						'lng',
						'level',
						'count',
						'id'
					])
					.where('user', '=', userId)
					.where('lastTimestamp', '>=', Date.now() - DAY)
					.orderBy('lastTimestamp', 'desc')
					.limit(1)
			)
			.with('combined', (qb) =>
				qb.selectFrom('latest').selectAll().unionAll(qb.selectFrom('top_favourites').selectAll())
			)
			.with('ranked', (qb) =>
				qb
					.selectFrom('combined')
					.selectAll()
					.select(sql<number>`ROW_NUMBER() OVER (PARTITION BY id)`.as('rn'))
			)
			.selectFrom('ranked')
			.orderBy('ranked.sort_order', 'desc')
			.orderBy('ranked.count', 'desc')
			.select(['ranked.address', 'ranked.lat', 'ranked.lng', 'ranked.level'])
			.where('ranked.rn', '=', 1)
			.execute(),
		favouriteRoutes: await db
			.with('top_favourites', (qb) =>
				qb
					.selectFrom('favouriteRoutes')
					.innerJoin(
						'favouriteLocations as fromLocations',
						'fromLocations.id',
						'favouriteRoutes.fromId'
					)
					.innerJoin('favouriteLocations as toLocations', 'toLocations.id', 'favouriteRoutes.toId')
					.select((eb) => [
						eb.lit(1).$castTo<number>().as('sort_order'),
						'toLocations.address as toAddress',
						'toLocations.lat as toLat',
						'toLocations.lng as toLng',
						'toLocations.level as toLevel',
						'fromLocations.address as fromAddress',
						'fromLocations.lat as fromLat',
						'fromLocations.lng as fromLng',
						'fromLocations.level as fromLevel',
						'favouriteRoutes.count',
						'favouriteRoutes.id'
					])
					.where('favouriteRoutes.user', '=', userId)
					.orderBy('favouriteRoutes.count', 'desc')
			)
			.with('latest', (qb) =>
				qb
					.selectFrom('favouriteRoutes')
					.innerJoin(
						'favouriteLocations as fromLocations',
						'fromLocations.id',
						'favouriteRoutes.fromId'
					)
					.innerJoin('favouriteLocations as toLocations', 'toLocations.id', 'favouriteRoutes.toId')
					.select((eb) => [
						eb.lit(2).$castTo<number>().as('sort_order'),
						'toLocations.address as toAddress',
						'toLocations.lat as toLat',
						'toLocations.lng as toLng',
						'toLocations.level as toLevel',
						'fromLocations.address as fromAddress',
						'fromLocations.lat as fromLat',
						'fromLocations.lng as fromLng',
						'fromLocations.level as fromLevel',
						'favouriteRoutes.count',
						'favouriteRoutes.id'
					])
					.where('favouriteRoutes.user', '=', userId)
					.where('favouriteRoutes.lastTimestamp', '>=', Date.now() - DAY)
					.orderBy('favouriteRoutes.lastTimestamp', 'desc')
					.limit(1)
			)
			.with('combined', (qb) =>
				qb.selectFrom('latest').selectAll().unionAll(qb.selectFrom('top_favourites').selectAll())
			)
			.with('ranked', (qb) =>
				qb
					.selectFrom('combined')
					.selectAll()
					.select(sql<number>`ROW_NUMBER() OVER (PARTITION BY id)`.as('rn'))
			)
			.selectFrom('ranked')
			.orderBy('ranked.sort_order', 'desc')
			.orderBy('ranked.count', 'desc')
			.select(['ranked.fromAddress', 'ranked.toAddress', 'ranked.fromLat', 'ranked.toLat', 'ranked.fromLng', 'ranked.toLng', 'ranked.fromLevel', 'ranked.toLevel'])
			.where('ranked.rn', '=', 1)
			.execute()
	};
}

const getCommonTour = (l1: Set<number>, l2: Set<number>) => {
	for (const e of l1) {
		if (l2.has(e)) {
			return e;
		}
	}
	return undefined;
};

export const actions = {
	booking: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const user = locals.session?.userId;
		if (!user) {
			return { msg: msg('accountDoesNotExist') };
		}

		const formData = await request.formData();

		const passengers = readInt(formData.get('passengers'));
		const luggage = readInt(formData.get('luggage'));
		const wheelchairs = readInt(formData.get('wheelchairs'));
		const json = formData.get('json');
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
		const endTime1 = readInt(formData.get('endTime1'));
		const startTime2 = readInt(formData.get('startTime2'));
		const endTime2 = readInt(formData.get('endTime2'));

		console.log('BOOKING PARAMS =', {
			passengers,
			luggage,
			wheelchairs,
			startFixed1,
			startFixed2,
			fromAddress1,
			toAddress1,
			fromAddress2,
			toAddress2,
			fromLat1,
			fromLng1,
			toLat1,
			toLng1,
			startTime1,
			endTime1,
			fromLat2,
			fromLng2,
			toLat2,
			toLng2,
			startTime2,
			endTime2
		});

		if (
			typeof json !== 'string' ||
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
			isNaN(endTime1) ||
			isNaN(fromLat2) ||
			isNaN(fromLng2) ||
			isNaN(toLat2) ||
			isNaN(toLng2) ||
			isNaN(startTime2) ||
			isNaN(endTime2)
		) {
			throw 'invalid booking params';
		}

		const capacities: Capacities = {
			bikes: 0,
			luggage,
			passengers,
			wheelchairs
		};
		const start1 = { lat: fromLat1, lng: fromLng1, address: fromAddress1 };
		const target1 = { lat: toLat1, lng: toLng1, address: toAddress1 };
		const start2 = { lat: fromLat2, lng: fromLng2, address: fromAddress2 };
		const target2 = { lat: toLat2, lng: toLng2, address: toAddress2 };

		const connection1 = {
			start: start1,
			target: target1,
			startTime: startTime1,
			targetTime: endTime1
		};

		const onlyOne = start1.lat === start2.lat && start1.lng === start2.lng;
		const connection2 = onlyOne
			? null
			: {
					start: start2,
					target: target2,
					startTime: startTime2,
					targetTime: endTime2
				};

		console.log(
			'BOOKING: C1=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection1), null, '\t')
		);
		console.log(
			'BOOKING: C2=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection2), null, '\t')
		);

		let success = false;
		let message: Msg | undefined = undefined;
		let request1: number | null = null;
		let request2: number | null = null;
		await db.transaction().execute(async (trx) => {
			await sql`LOCK TABLE tour, request, event, availability IN ACCESS EXCLUSIVE MODE;`.execute(
				trx
			);

			let firstBooking = undefined;
			let secondBooking = undefined;
			if (connection1 != null) {
				firstBooking = await bookRide(connection1, capacities, startFixed1 === '1', trx);
				if (firstBooking == undefined) {
					console.log('FIRST BOOKING FAILED');
					message = onlyOne ? msg('bookingError') : msg('bookingError1');
					return;
				}
			}
			if (connection2 != null) {
				secondBooking = await bookRide(connection2, capacities, startFixed2 === '1', trx);
				if (secondBooking == undefined) {
					console.log('SECOND BOOKING FAILED');
					message = msg('bookingError2');
					return;
				}
			}
			if (
				connection1 != null &&
				connection2 != null &&
				firstBooking!.tour != undefined &&
				secondBooking!.tour != undefined
			) {
				const newTour = getCommonTour(firstBooking!.mergeTourList, secondBooking!.mergeTourList);
				if (newTour != undefined) {
					firstBooking!.tour = newTour;
					secondBooking!.tour = newTour;
				}
			}
			if (connection1 != null) {
				request1 = await insertRequest(
					firstBooking!.best,
					capacities,
					connection1,
					user,
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
				request2 = await insertRequest(
					secondBooking!.best,
					capacities,
					connection2,
					user,
					secondBooking!.eventGroupUpdateList,
					[...secondBooking!.mergeTourList],
					secondBooking!.pickupEventGroup,
					secondBooking!.dropoffEventGroup,
					secondBooking!.neighbourIds,
					secondBooking!.directDurations,
					trx
				);
			}

			console.log('INSERTION DONE, SETTING SUCCESS=TRUE - REQUIESTS:', { request1, request2 });

			success = true;
			return;
		});

		if (success) {
			console.log('SAVING JOURNEY');
			const id = (
				await db
					.insertInto('journey')
					.values({
						user,
						json,
						request1: request1!,
						request2
					})
					.returning('id')
					.executeTakeFirstOrThrow()
			).id;

			console.log('SENDING EMAIL TO TAXI OWNERS');
			try {
				const rideInfo = await db
					.selectFrom('request')
					.innerJoin('tour', 'request.tour', 'tour.id')
					.innerJoin('vehicle', 'tour.vehicle', 'vehicle.id')
					.innerJoin('user', 'vehicle.company', 'user.companyId')
					.select((eb) => [
						'user.email',
						'user.name',
						eb
							.selectFrom('event')
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'asc')
							.limit(1)
							.select('address')
							.as('firstAddress'),
						eb
							.selectFrom('event')
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'asc')
							.limit(1)
							.select('event.scheduledTimeStart')
							.as('firstTime'),
						eb
							.selectFrom('event')
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'desc')
							.limit(1)
							.select('address')
							.as('lastAddress'),
						eb
							.selectFrom('event')
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'desc')
							.limit(1)
							.select('event.scheduledTimeStart')
							.as('lastTime')
					])
					.where('request.id', '=', request1!)
					.where('user.isTaxiOwner', '=', true)
					.execute();
				await Promise.all(rideInfo.map((r) => sendMail(NewRide, 'Neue Beförderung', r.email, r)));
			} catch {
				/* nothing we can do about this */
			}

			return redirect(302, `/bookings/${id}`);
		}

		return { msg: message! };
	},
	updateFavourites: async ({ request, locals }) => {
		const user = locals.session?.userId;
		if (!user || typeof user != 'number') {
			return { msg: msg('accountDoesNotExist') };
		}
		const formData = await request.formData();
		const fromAddress = formData.get('fromAddress');
		const fromLat = formData.get('fromLat');
		const fromLon = formData.get('fromLon');
		const fromLevel = formData.get('fromLevel');
		const toAddress = formData.get('toAddress');
		const toLat = formData.get('toLat');
		const toLon = formData.get('toLon');
		const toLevel = formData.get('toLevel');
		if (
			typeof fromAddress !== 'string' ||
			typeof fromLat !== 'string' ||
			typeof fromLevel !== 'string' ||
			typeof fromLon !== 'string'
		) {
			return { msg: msg('invalidFrom') };
		}
		const fromLatitude = parseFloat(fromLat);
		const fromLongtitude = parseFloat(fromLon);
		const fromLvl = parseInt(fromLevel);
		if (isNaN(fromLatitude) || isNaN(fromLongtitude) || isNaN(fromLvl)) {
			return { msg: msg('invalidFrom') };
		}
		let currentFavourites = await db
			.selectFrom('favouriteLocations')
			.where('user', '=', user)
			.selectAll()
			.execute();
		const fromMatch = currentFavourites.find(
			(fav) => isSamePlace(fav, { lat: fromLatitude, lng: fromLongtitude }) && fav.level === fromLvl
		);
		let fromId = undefined;
		if (fromMatch) {
			await db
				.updateTable('favouriteLocations')
				.where('user', '=', user)
				.where('favouriteLocations.id', '=', fromMatch.id)
				.set({ count: fromMatch.count + 1, lastTimestamp: Date.now() })
				.execute();
		} else {
			fromId = (await db
				.insertInto('favouriteLocations')
				.values({
					lat: fromLatitude,
					lng: fromLongtitude,
					level: fromLvl,
					address: fromAddress,
					user,
					count: 1,
					lastTimestamp: Date.now()
				})
				.returning('id')
				.executeTakeFirst())!.id;
		}

		if (
			typeof toAddress !== 'string' ||
			typeof toLat !== 'string' ||
			typeof toLon !== 'string' ||
			typeof toLevel !== 'string'
		) {
			return { msg: msg('invalidFrom') };
		}
		const toLatitude = parseFloat(toLat);
		const toLongitude = parseFloat(toLon);
		const toLvl = parseInt(toLevel);
		if (isNaN(toLatitude) || isNaN(toLongitude) || isNaN(toLvl)) {
			return { msg: msg('invalidFrom') };
		}
		currentFavourites = await db
			.selectFrom('favouriteLocations')
			.where('user', '=', user)
			.selectAll()
			.execute();
		const toMatch = currentFavourites.find(
			(fav) => isSamePlace(fav, { lat: toLatitude, lng: toLongitude }) && fav.level === toLvl
		);
		let toId = undefined;
		if (toMatch) {
			await db
				.updateTable('favouriteLocations')
				.where('user', '=', user)
				.where('favouriteLocations.id', '=', toMatch.id)
				.set({ count: toMatch.count + 1, lastTimestamp: Date.now() })
				.execute();
		} else {
			toId = (await db
				.insertInto('favouriteLocations')
				.values({
					lat: toLatitude,
					lng: toLongitude,
					level: toLvl,
					address: toAddress,
					user,
					count: 1,
					lastTimestamp: Date.now()
				})
				.returning(['favouriteLocations.id'])
				.executeTakeFirst())!.id;
		}
		toId = toId ?? toMatch?.id;
		fromId = fromId ?? fromMatch?.id;
		if (
			toId == undefined ||
			fromId == undefined ||
			isSamePlace({ lat: fromLatitude, lng: fromLongtitude }, { lat: toLatitude, lng: toLongitude })
		) {
			return {};
		}
		if (fromMatch && toMatch) {
			const currentFavouriteRoutes = await db
				.selectFrom('favouriteRoutes')
				.where('user', '=', user)
				.where('fromId', '=', fromMatch.id)
				.where('toId', '=', toMatch.id)
				.select(['favouriteRoutes.id'])
				.executeTakeFirst();
			if (currentFavouriteRoutes) {
				await db
					.updateTable('favouriteRoutes')
					.where('favouriteRoutes.id', '=', currentFavouriteRoutes.id)
					.set((eb) => ({ count: eb('count', '+', 1), lastTimestamp: Date.now() }))
					.returning('favouriteRoutes.id')
					.execute();
			} else {
				await db
					.insertInto('favouriteRoutes')
					.values({ user, toId, fromId, count: 1, lastTimestamp: Date.now() })
					.execute();
			}
		} else {
			await db
				.insertInto('favouriteRoutes')
				.values({ user, toId, fromId, count: 1, lastTimestamp: Date.now() })
				.execute();
		}
		return {};
	}
};
