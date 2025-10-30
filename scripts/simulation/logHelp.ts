export function logHelp() {
	console.log('This script simulates possible user actions in the motis-prima-project.');
	console.log(
		'The script will NOT create any companies or vehicles. It will however set all relevant availabilities at the start of the script.'
	);
	console.log(
		'You can adjust the probability of choosing each available action in /scripts/simulation/script.ts. Look for actionProbabilities to do so'
	);
	console.log('The following is a list of currently available simulated user actions:');
	console.log(
		'bookRide:   attempts to book a taxi, you can adjust the random parameters in /scripts/simulation/generateBookingParameters.ts'
	);
	console.log(
		'cancelTour: if there is at least one uncancelled tour, choose a random uncancelled tour and cancel it'
	);
	console.log();
	console.log('The script accepts the following flags:');
	console.log(
		'--health: performs some necessary checks for the database state to be healthy after each simulation action. Will stop if any errors are found. Be aware: the checks take a lot longer than the simulation actions.'
	);
	console.log(
		'--bu: The script will do backups iff this flag is set. Backups happen after each simulated action as full backups via pg_dump.'
	);
	console.log('--runs=x: Sets the amount of simulation actions to perform');
	console.log('--second=x: Sets the amount of seconds after which the script is terminated');
	console.log(
		'--ongoing: Will run the script indefinitely (or if the health flag is set until there is an error)'
	);
	console.log();
	console.log(
		'If you set more than one of the three flags runs/seconds/ongoing only one of these will be considered with the importance order being ongoing>seconds>runs'
	);
	console.log(
		'If none of these three flags is chosen, the scripts will only perform one simulation action'
	);
	console.log();
	console.log('The lat/lng-pairs used for the bookRide simulation action are derived as follows:');
	console.log(
		'Take the set of all lat/lng-pairs of an osm.pbf file, restrict to those points inside of the Weisswasser multipolygon,'
	);
	console.log(
		'divide the multipolygon into squares with fixed side length, randomly choose at most one lat/lng-pair from each such square'
	);
}
