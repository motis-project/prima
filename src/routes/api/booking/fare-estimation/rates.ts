export type RateInfo = {
	anfahrt: Rate;
	tag: Rate;
	nacht: Rate;
	returnFree: boolean;
	zuschlag: Zuschlag;
	wartzeitPStd: number;
	beginnNacht: number;
	endeNacht: number;
};

export type Rate = {
	grundpreis: number;
	pKm: Array<[number, number]>;
	pauschal: Array<[number, number]>;
};

export type Zuschlag = {
	grossraum: number;
};

const ratesGoerlitz: RateInfo = {
	anfahrt: {
		grundpreis: 0,
		pKm: [],
		pauschal: [
			[0, 1000],
			[10000, 2000]
		]
	},
	tag: {
		grundpreis: 450,
		pKm: [
			[0, 350],
			[3000, 210],
			[11000, 210]
		],
		pauschal: []
	},
	nacht: {
		grundpreis: 550,
		pKm: [
			[0, 360],
			[3000, 220],
			[11000, 220]
		],
		pauschal: []
	},
	returnFree: true,
	zuschlag: {
		grossraum: 900
	},
	wartzeitPStd: 3500,
	beginnNacht: 21,
	endeNacht: 5
};

const ratesBautzen: RateInfo = {
	anfahrt: {
		grundpreis: 450,
		pKm: [[0, 130]],
		pauschal: []
	},
	tag: {
		grundpreis: 450,
		pKm: [[0, 250]],
		pauschal: []
	},
	nacht: {
		grundpreis: 450,
		pKm: [[0, 270]],
		pauschal: []
	},
	returnFree: true,
	zuschlag: {
		grossraum: 700
	},
	wartzeitPStd: 4500,
	beginnNacht: 22,
	endeNacht: 6
};

export const rateInfo = [ratesGoerlitz, ratesBautzen];
