export type RateInfo = {
	anfahrt: Rate;
	tag: Rate;
	nacht: Rate;
	zuschlag: Zuschlag;
	wartzeitPh: number;
	beginnNacht: number;
	endNacht: number;
};

export type Rate = {
	grundpreis: number;
	pkm: Array<[number, number]>;
	pauschal: Array<[number, number]>;
	returnFree: boolean;
};

export type Zuschlag = {
	grossraum: number;
};
