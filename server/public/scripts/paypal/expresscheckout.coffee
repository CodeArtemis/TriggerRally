NVPRequest = require './nvprequest'
secret     = require './secret'

###

Express Checkout flow:

SetExpressCheckout
[redirect to paypal]
GetExpressCheckoutDetails
DoExpressCheckoutPayment

https://developer.paypal.com/webapps/developer/docs/classic/express-checkout/gs_expresscheckout/

###
