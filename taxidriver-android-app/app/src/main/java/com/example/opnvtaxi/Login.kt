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

    private val _loginErrorEvent = MutableSharedFlow<Boolean>()
    val loginErrorEvent = _loginErrorEvent.asSharedFlow()

    private val _networkErrorEvent = MutableSharedFlow<Boolean>()
    val networkErrorEvent = _networkErrorEvent.asSharedFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            try {
                val response = Api.apiService.login(email, password)
                Log.d("Login Response", response.toString())
                if (response.status == 302) {
                    // successful login
                    _navigationEvent.emit(true)
                } else {
                    _loginErrorEvent.emit(true)
                }
            } catch (e: Exception) {
                Log.d("Login Response Network Error", e.message!!)
                _networkErrorEvent.emit(true)
            }
        }
    }
}

@Composable
fun Login(
    navController: NavController,
    viewModel: LoginViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {

    var isLoginFailed by remember { mutableStateOf(false) }
    var isNetworkError by remember { mutableStateOf(false)}

    LaunchedEffect(key1 = viewModel) {
        // Catching successful login event and navigation to the next screen
        launch {
            viewModel.navigationEvent.collect { shouldNavigate ->
                Log.d("Navigation event", "Navigation triggered.")
                if (shouldNavigate) {
                    Log.d("Navigation event", "Navigating to journeys.")
                    navController.navigate("journeys")
                }
            }
        }

        // Catching event when login failed due to incorrect login data
        launch {
            viewModel.loginErrorEvent.collect { error ->
                isLoginFailed = error
            }
        }

        // Catching event when a network error occurs
        launch {
            viewModel.networkErrorEvent.collect { error ->
                isNetworkError = error
            }
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
                isLoginFailed ->
                    Text(
                        text = stringResource(id = R.string.wrong_login_data),
                        color = Color.Red,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
            }
            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                    isLoginFailed = false
                },
                label = { Text(stringResource(id = R.string.email_label)) },
                maxLines = 1,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                isError = isLoginFailed
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    isLoginFailed = false
                },
                label = { Text(stringResource(id = R.string.password_label)) },
                maxLines = 1,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                isError = isLoginFailed
            )
            Spacer(modifier = Modifier.height(20.dp))
            Button(
                onClick = {
                    isLoginFailed = false
                    Log.d("Login", "E-Mail: ${email}, Password: $password")
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