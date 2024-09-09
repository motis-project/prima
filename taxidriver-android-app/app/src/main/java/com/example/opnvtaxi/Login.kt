package com.example.opnvtaxi

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.Button
import androidx.compose.material.OutlinedTextField
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.constraintlayout.compose.ConstraintLayout
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.example.opnvtaxi.services.Api
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

class LoginViewModel : ViewModel() {
    // Event which will be omitted to the Login component, indicating success of the login operation
    private val _navigationEvent = MutableSharedFlow<Boolean>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    private val _loginErrorEvent = MutableSharedFlow<String?>()
    val loginErrorEvent = _loginErrorEvent.asSharedFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            try {
                val response = Api.apiService.login(email, password)
                Log.d("Login Response", response.toString())
                // TODO: handle storing response token
                if (response.status == 302) {
                    // successful login
                    _navigationEvent.emit(true)
                } else {
                    _loginErrorEvent.emit("Password oder E-Mail sind inkorrekt.")
                }
            } catch (e: Exception) {
                Log.d("Login Response Error", e.message!!)
                // TODO: handle possible network or other similar errors
            }
        }
    }
}

@Composable
fun Login(
    navController: NavController,
    viewModel: LoginViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {

    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Catching successful omit event and navigation to the next screen
    LaunchedEffect(key1 = viewModel) {
        viewModel.navigationEvent.collect { shouldNavigate ->
            if (shouldNavigate) {
                navController.navigate("journeys")
            }
        }

    }

    // Catching event when login failed due to incorrect login data
    LaunchedEffect(key1 = viewModel) {
        viewModel.loginErrorEvent.collect { error ->
            errorMessage = error
        }
    }

    ConstraintLayout(modifier = Modifier.fillMaxSize()) {
        var email by remember {
            mutableStateOf("")
        }

        var password by remember {
            mutableStateOf("")
        }

        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when {
                errorMessage != null ->
                    Text(
                        text = errorMessage!!,
                        color = Color.Red,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
            }
            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                    errorMessage = null
                },
                label = { Text("E-Mail") },
                maxLines = 1,
                isError = errorMessage != null
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    errorMessage = null
                },
                label = { Text("Passwort") },
                maxLines = 1,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                isError = errorMessage != null
            )
            Spacer(modifier = Modifier.height(20.dp))
            Button(
                onClick = {
                    errorMessage = null
                    Log.d("Login", "E-Mail: ${email}, Passwort: ${password}")
                    viewModel.login(email, password)
                }
            ) {
                Text(
                    text = stringResource(id = R.string.login_button_text), fontSize = 18.sp
                )
            }
        }
    }
}