export const createTrace = (lines: number[][][]): string => {
	const utcDate = new Date(Date.UTC(2024, 7, 31, 14, 0, 0));

	let result =
		'<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="runtracker"><metadata/><trk><name></name><desc></desc>';
	result += lines.reduce((accum, curr) => {
		let segmentTag = '<trkseg>';
		segmentTag += curr
			.map(
				(point) =>
					`<trkpt lat="${point[1]}" lon="${point[0]}"><ele>0</ele><time>${utcDate.toISOString()}</time></trkpt>`
			)
			.join('');
		segmentTag += '</trkseg>';
		utcDate.setSeconds(utcDate.getSeconds() + 5);
		return (accum += segmentTag);
	}, '');
	result += '</trk></gpx>';
	return result;
};
