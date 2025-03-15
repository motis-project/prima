package de.motis.prima.data

import android.content.Context
import android.content.SharedPreferences
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class CookieStore(context: Context) : CookieJar {
    private val preferences: SharedPreferences =
        context.getSharedPreferences("cookies", Context.MODE_PRIVATE)

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val editor = preferences.edit()
        val serializedCookie = cookies.joinToString(";") { cookie -> cookie.toString() }
        editor.putString(url.host, serializedCookie)
        editor.apply()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookiesString = preferences.getString(url.host, null)
        if (cookiesString.isNullOrEmpty()) {
            return listOf()
        }

        val cookie = Cookie.parse(url, cookiesString) ?: return listOf()
        return listOf(cookie)
    }

    fun clearCookies(host: String? = null) {
        val editor = preferences.edit()
        if (host != null) {
            editor.remove(host)
        } else {
            editor.clear()
        }
        editor.apply()
    }

    fun isEmpty(): Boolean {
        return preferences.all.isEmpty()
    }
}
