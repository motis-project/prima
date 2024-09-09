package com.example.opnvtaxi

data class Journey(
    val id: String,
    val subJourneys: List<SubJourney>
)

data class SubJourney(
    val startTime: String,
    val startLocation: String,
    val personName: String,
    var endLocation: String,
    val endTime: String
)

fun getJourneys(): List<Journey> {
    return listOf(
        Journey(
            id = "234236",
            subJourneys = listOf(
                SubJourney(
                    startTime = "08:04",
                    startLocation = "Dieburger Str. 1, Kranichstein",
                    personName = "Helena Musterfrau",
                    endLocation = "Holzhofallee 5, Darmstadt",
                    endTime = "08:25"
                )
            )
        ),
        Journey(
            id = "567532",
            subJourneys = listOf(
                SubJourney(
                    startTime = "08:35",
                    startLocation = "Frankfurter Str. 79, Darmstadt",
                    personName = "Max Mustermann",
                    endLocation = "Goebelstraße 11, Darmstadt",
                    endTime = "09:12"
                ),
                SubJourney(
                    startTime = "09:30",
                    startLocation = "Frankfurter Str. 12, Darmstadt",
                    personName = "Henrietta Müller",
                    endLocation = "Eschollbrücker Str. 30, Darmstadt",
                    endTime = "09:43"
                )
            )
        ),
        Journey(
            id = "789543",
            subJourneys = listOf(
                SubJourney(
                    startTime = "09:55",
                    startLocation = "Holzgasallee 21, Darmstadt",
                    personName = "Klaus Santa",
                    endLocation = "Ludwigshöhstraße 105, Darmstadt",
                    endTime = "10:22"
                ),
                SubJourney(
                    startTime = "10:45",
                    startLocation = "Frankfurter Str. 12, Darmstadt",
                    personName = "Henrietta Müller",
                    endLocation = "Friedenspl. 1, Darmstadt",
                    endTime = "11:08"
                ),
                SubJourney(
                    startTime = "11:16",
                    startLocation = "Frankfurter Str. 27, Darmstadt",
                    personName = "Annalena Mayer",
                    endLocation = "Grafenstraße 9, Darmstadt",
                    endTime = "12:34"
                )
            )
        )
    );
}