import type { TestParams } from '$lib/util/booking/testParams';

export const tests: TestParams[] = [
	// printhere
	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 1,
				entity: 'tourCount',
				tourCount: 2,
				requestCount: -1,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.49978764854629,
					lng: 14.695370741483487
				},
				{
					lat: 51.49551147136415,
					lng: 14.67944750945557
				}
			],
			destinations: [
				{
					lat: 51.49117009326031,
					lng: 14.66185910283707
				},
				{
					lat: 51.49408598981654,
					lng: 14.65009880728681
				}
			],
			times: [1750753744965, 1750760944965],
			isDepartures: [true, true],
			companies: [
				{
					lat: 51.50226454583827,
					lng: 14.712478531647974
				}
			]
		},
		uuid: '9d1780af-6cb7-401a-bffa-957982eeae72'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 1,
				entity: 'tourCount',
				tourCount: 2,
				requestCount: -1,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.50008466056579,
					lng: 14.69715636845126
				},
				{
					lat: 51.4806710325108,
					lng: 14.878148283090582
				}
			],
			destinations: [
				{
					lat: 51.49151865157296,
					lng: 14.666689864965917
				},
				{
					lat: 51.460602595780585,
					lng: 14.94294827018291
				}
			],
			times: [1750753658858, 1750756458858],
			isDepartures: [true, true],
			companies: [
				{
					lat: 51.50214943978406,
					lng: 14.712266771389835
				}
			]
		},
		uuid: 'be33261f-c03d-4563-ac26-3d97165472b0'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 0,
				entity: 'requestCompanyMatch',
				start: {
					lat: 51.41148238219216,
					lng: 14.57652319398457
				},
				destination: {
					lat: 51.40942983996766,
					lng: 14.561989191105482
				},
				company: {
					lat: 51.41233758092554,
					lng: 14.582391640428142
				},
				expectedPosition: null,
				tourCount: null,
				requestCount: null
			},
			{
				evalAfterStep: 1,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 2,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 1,
				entity: 'tourCount',
				tourCount: 1,
				requestCount: -1,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 1,
				entity: 'requestCompanyMatch',
				start: {
					lat: 51.40756837023437,
					lng: 14.548894002299306
				},
				destination: {
					lat: 51.40062296970717,
					lng: 14.525036299462272
				},
				company: {
					lat: 51.41233758092554,
					lng: 14.582391640428142
				},
				expectedPosition: null,
				tourCount: null,
				requestCount: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.41148238219216,
					lng: 14.57652319398457
				},
				{
					lat: 51.40756837023437,
					lng: 14.548894002299306
				}
			],
			destinations: [
				{
					lat: 51.40942983996766,
					lng: 14.561989191105482
				},
				{
					lat: 51.40062296970717,
					lng: 14.525036299462272
				}
			],
			times: [1750752195540, 1750752795540],
			isDepartures: [true, true],
			companies: [
				{
					lat: 51.52683993138652,
					lng: 14.693912761275868
				},
				{
					lat: 51.41233758092554,
					lng: 14.582391640428142
				}
			]
		},
		uuid: 'b9fba75f-4a9f-4517-851b-e37f5a2f3c8c'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 1,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 2,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 1,
				entity: 'tourCount',
				tourCount: 1,
				requestCount: -1,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 1,
				entity: 'startPosition',
				tourCount: -1,
				requestCount: -1,
				expectedPosition: 2,
				start: {
					lat: 51.52124572625536,
					lng: 14.708035511444422
				},
				destination: {
					lat: 51.52034930151788,
					lng: 14.714407676481528
				},
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.52378729783385,
					lng: 14.69671972107028
				},
				{
					lat: 51.52124572625536,
					lng: 14.708035511444422
				}
			],
			destinations: [
				{
					lat: 51.522787494139266,
					lng: 14.703313526631206
				},
				{
					lat: 51.52034930151788,
					lng: 14.714407676481528
				}
			],
			times: [1750400244564, 1750400544564],
			isDepartures: [true, true],
			companies: [
				{
					lat: 51.526125715149306,
					lng: 14.689196668616432
				}
			]
		},
		uuid: 'fceb2a54-7024-4a9b-a214-b2655cb7d504'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 1,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 2,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 2,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 3,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 2,
				entity: 'tourCount',
				tourCount: 1,
				requestCount: -1,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.527358114107585,
					lng: 14.697645909939212
				},
				{
					lat: 51.48886873577544,
					lng: 14.629302941137638
				},
				{
					lat: 51.518385803966225,
					lng: 14.661366479080641
				}
			],
			destinations: [
				{
					lat: 51.520202846066724,
					lng: 14.664217543076205
				},
				{
					lat: 51.47846438451026,
					lng: 14.661735025493101
				},
				{
					lat: 51.49116349369399,
					lng: 14.625863174614835
				}
			],
			times: [1750247690692, 1750248850692, 1750248240000],
			isDepartures: [true, true, true],
			companies: [
				{
					lat: 51.530278670149244,
					lng: 14.706657669152918
				}
			]
		},
		uuid: '4f6728fa-2cd0-42e4-9c49-eb7386d3fcfx'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 1,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 2,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 2,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 3,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 2,
				entity: 'tourCount',
				tourCount: 1,
				requestCount: -1,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.527358114107585,
					lng: 14.697645909939212
				},
				{
					lat: 51.48886873577544,
					lng: 14.629302941137638
				},
				{
					lat: 51.518385803966225,
					lng: 14.661366479080641
				}
			],
			destinations: [
				{
					lat: 51.520202846066724,
					lng: 14.664217543076205
				},
				{
					lat: 51.47846438451026,
					lng: 14.661735025493101
				},
				{
					lat: 51.49116349369399,
					lng: 14.625863174614835
				}
			],
			times: [1750247670692, 1750248850692, 1750248140000],
			isDepartures: [true, true, true],
			companies: [
				{
					lat: 51.530278670149244,
					lng: 14.706657669152918
				}
			]
		},
		uuid: '4f6728fa-2cd0-42e4-9c49-eb7386d3fcff'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 1,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 2,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 1,
				entity: 'tourCount',
				tourCount: 1,
				requestCount: -1,
				expectedPosition: null,
				start: null,
				destination: null,
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.50049423863311,
					lng: 14.700125777933437
				},
				{
					lat: 51.49891682074758,
					lng: 14.636875019641622
				}
			],
			destinations: [
				{
					lat: 51.491453680659845,
					lng: 14.661142259725608
				},
				{
					lat: 51.51571958072245,
					lng: 14.656366778744939
				}
			],
			times: [1749206842990, 1749207742990],
			isDepartures: [true, true],
			companies: [
				{
					lat: 51.502278807277605,
					lng: 14.711610880111863
				}
			]
		},
		uuid: 'd1fad5fb-f841-4e3c-b21d-a35663f71039'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 1,
				entity: 'startPosition',
				tourCount: -1,
				requestCount: -1,
				expectedPosition: 0,
				start: {
					lat: 51.49465839904684,
					lng: 14.719442801988833
				},
				destination: {
					lat: 51.47958853282958,
					lng: 14.72251402209821
				},
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.49465839904684,
					lng: 14.719442801988833
				},
				{
					lat: 51.47606896351152,
					lng: 14.722514022099006
				}
			],
			destinations: [
				{
					lat: 51.47958853282958,
					lng: 14.72251402209821
				},
				{
					lat: 51.46336565051166,
					lng: 14.74487250449556
				}
			],
			times: [1749143608824, 1749143908824],
			isDepartures: [true, true],
			companies: [
				{
					lat: 51.5021304238399,
					lng: 14.7129780281048
				}
			]
		},
		uuid: '73e5bae1-3648-43d9-8db2-399875e13fe8'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 0,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 1,
				expectedPosition: -1,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 1,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 2,
				expectedPosition: -1,
				start: null,
				destination: null,
				company: null
			},
			{
				evalAfterStep: 1,
				entity: 'tourCount',
				tourCount: 1,
				requestCount: -1,
				expectedPosition: -1,
				start: null,
				destination: null,
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.49515596447975,
					lng: 14.679697910637685
				},
				{
					lat: 51.50544687066633,
					lng: 14.642429986843212
				}
			],
			destinations: [
				{
					lat: 51.49939898802958,
					lng: 14.635469440764979
				},
				{
					lat: 51.51970586364183,
					lng: 14.66316661370189
				}
			],
			times: [1749138735856, 1749139335856],
			isDepartures: [true, true],
			companies: [
				{
					lat: 51.509779188629835,
					lng: 14.741907791211815
				}
			]
		},
		uuid: '09c7e76e-14cf-40cf-b32b-6a3ea5a43099'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 0,
				entity: 'requestCompanyMatch',
				start: {
					lat: 51.49060264996811,
					lng: 14.625531716946114
				},
				destination: {
					lat: 51.491209466285426,
					lng: 14.661981306469755
				},
				company: {
					lat: 51.482329691448484,
					lng: 14.651830066327534
				},
				expectedPosition: null,
				tourCount: null,
				requestCount: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.49060264996811,
					lng: 14.625531716946114
				}
			],
			destinations: [
				{
					lat: 51.491209466285426,
					lng: 14.661981306469755
				}
			],
			times: [1749123470408],
			isDepartures: [true],
			companies: [
				{
					lat: 51.51942429622022,
					lng: 14.663163034255547
				},
				{
					lat: 51.52852265326581,
					lng: 14.60064892090358
				},
				{
					lat: 51.482329691448484,
					lng: 14.651830066327534
				}
			]
		},
		uuid: 'b4f64dfe-2130-4978-b322-b3d56d31e090'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 0,
				entity: 'requestCount',
				tourCount: -1,
				requestCount: 1,
				expectedPosition: -1,
				start: null,
				destination: null,
				company: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.5097590428102,
					lng: 14.742580233557334
				}
			],
			destinations: [
				{
					lat: 51.514950532171554,
					lng: 14.754356902851555
				}
			],
			times: [1749123340891],
			isDepartures: [true],
			companies: [
				{
					lat: 51.5026080337135,
					lng: 14.71234901479113
				}
			]
		},
		uuid: 'fb869d06-6999-458c-9c75-14a42dc1d775'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 0,
				entity: 'requestCompanyMatch',
				start: {
					lat: 51.484850160402175,
					lng: 14.722058640450342
				},
				destination: {
					lat: 51.457614225700326,
					lng: 14.75446116220752
				},
				company: {
					lat: 51.49209954968157,
					lng: 14.721071772023038
				},
				expectedPosition: null,
				tourCount: null,
				requestCount: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.484850160402175,
					lng: 14.722058640450342
				}
			],
			destinations: [
				{
					lat: 51.457614225700326,
					lng: 14.75446116220752
				}
			],
			times: [1749121411730],
			isDepartures: [true],
			companies: [
				{
					lat: 51.53048792186061,
					lng: 14.707017666200642
				},
				{
					lat: 51.49209954968157,
					lng: 14.721071772023038
				},
				{
					lat: 51.47965211310424,
					lng: 14.899856519544784
				},
				{
					lat: 51.40387475880436,
					lng: 14.531124261308321
				},
				{
					lat: 51.384902207670535,
					lng: 14.616315986356199
				},
				{
					lat: 51.502636235270955,
					lng: 14.711413136930162
				}
			]
		},
		uuid: '0404b58c-f62d-4f60-ad8c-d9d2c57ed5ad'
	},
	// endoftest

	// startoftest
	{
		conditions: [
			{
				evalAfterStep: 0,
				entity: 'requestCompanyMatch',
				start: {
					lat: 51.414031522923324,
					lng: 14.587200695662574
				},
				destination: {
					lat: 51.420838812774434,
					lng: 14.546268001544718
				},
				company: {
					lat: 51.40892712567921,
					lng: 14.555387900612914
				},
				expectedPosition: null,
				tourCount: null,
				requestCount: null
			}
		],
		process: {
			starts: [
				{
					lat: 51.414031522923324,
					lng: 14.587200695662574
				}
			],
			destinations: [
				{
					lat: 51.420838812774434,
					lng: 14.546268001544718
				}
			],
			times: [1749120368965],
			isDepartures: [true],
			companies: [
				{
					lat: 51.50202983176706,
					lng: 14.711266099437012
				},
				{
					lat: 51.40892712567921,
					lng: 14.555387900612914
				}
			]
		},
		uuid: '599cb1cd-74bd-4096-aeaf-edb121c26cd9'
	}
	// endoftest
];
