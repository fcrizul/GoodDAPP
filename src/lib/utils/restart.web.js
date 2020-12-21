export default redirectUrl => {
  if (redirectUrl) {
    window.location.replace(redirectUrl)
  } else {
    window.location.reload(true)
  }
}
