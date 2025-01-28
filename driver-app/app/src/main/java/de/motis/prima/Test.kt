package de.motis.prima

import android.util.Log
import androidx.compose.runtime.Composable
import androidx.lifecycle.ViewModel

class TestViewModel : ViewModel() {
    var test = ""

    init {
        Log.d("test", "init")
        test = "some"
    }
}

@Composable
fun TestView(viewModel: TestViewModel) {
    Log.d("test", viewModel.test)
}