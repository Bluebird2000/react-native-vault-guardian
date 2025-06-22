class SSLPinningModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SSLPinningModule"

  @ReactMethod
  fun validatePinnedCertificate(promise: Promise) {
    val hostname = "yourserver.com"
    val client = OkHttpClient.Builder()
      .certificatePinner(
        CertificatePinner.Builder()
          .add(hostname, "sha256/yourPinHere==")
          .build()
      )
      .build()

    val request = Request.Builder()
      .url("https://$hostname")
      .build()

    client.newCall(request).enqueue(object : Callback {
      override fun onFailure(call: Call, e: IOException) {
        promise.resolve(false)
      }

      override fun onResponse(call: Call, response: Response) {
        promise.resolve(response.isSuccessful)
      }
    })
  }
}
