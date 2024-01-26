import GenericHandler from '../handlers/generic.handler.js';
import { logger } from '../utils/logger.utils.js';
import { getOrderById, getCustomerById } from '../client/query.client.js';
import CustomError from '../errors/custom.error.js';
import { HTTP_STATUS_BAD_REQUEST } from '../constants/http-status.constants.js';
import { send } from '../extensions/sendgrid.extension.js';
import { convertMoneyToText } from '../utils/money.utils.js';

class OrderConfirmationHandler extends GenericHandler {
  constructor() {
    super();
  }
  async sendMail(
    senderEmailAddress,
    receiverEmailAddress,
    templateId,
    orderDetails
  ) {
    await send(
      senderEmailAddress,
      receiverEmailAddress,
      templateId,
      orderDetails
    );
  }

  async process(messageBody) {
    logger.info(JSON.stringify(messageBody));
    const senderEmailAddress = process.env.SENDER_EMAIL_ADDRESS;
    const templateId = process.env.ORDER_CONFIRMATION_TEMPLATE_ID;

    const orderId = messageBody.resource.id;
    const order = await getOrderById(orderId);
    if (order) {
      let customer;
      if (order.customerId) {
        customer = await getCustomerById(order.customerId);
      }

      const orderLineItems = [];
      for (const lineItem of order.lineItems) {
        const item = {
          productName: lineItem.name,
          productQuantity: lineItem.quantity,
          productSku: lineItem.variant.sku,
          productImage: lineItem.variant.images[0],
          productSubTotal: convertMoneyToText(lineItem.totalPrice),
        };
        orderLineItems.push(item);
      }

      const orderDetails = {
        orderNumber: order.orderNumber ? order.orderNumber : '',
        customerEmail: order.customerEmail,
        customerFirstName: customer?.firstName
          ? customer.firstName
          : 'Customer',
        customerMiddleName: customer?.middleName ? customer.middleName : '',
        customerLastName: customer?.lastName ? customer.lastName : '',
        orderCreationTime: order.createdAt,
        orderTotalPrice: convertMoneyToText(order.totalPrice),
        orderTaxedPrice: convertMoneyToText(order.taxedPrice),
        orderLineItems,
      };

      logger.info(
        `Ready to send order confirmation email of customer registration : customerEmail=${orderDetails.customerEmail}, orderNumber=${orderDetails.orderNumber}, customerFirstName=${orderDetails.customerFirstName}, customerLastName=${orderDetails.customerLastName}, customerMiddleName=${orderDetails.customerMiddleName}, customerCreationTime=${orderDetails.orderCreationTime}, orderTotalPrice=${orderDetails.orderTotalPrice}, orderTaxedPrice=${orderDetails.orderTaxedPrice} `
      );
      await this.sendMail(
        senderEmailAddress,
        order.customerEmail,
        templateId,
        orderDetails
      );
      // logger.info(
      //     `Confirmation email of customer registration has been sent to ${customerDetails.customerEmail}.`
      // );
    } else if (!order) {
      throw new CustomError(
        HTTP_STATUS_BAD_REQUEST,
        `Unable to get order details with order ID ${orderId}`
      );
    } else {
      throw new CustomError(
        HTTP_STATUS_BAD_REQUEST,
        `Unable to get customer details with customer ID ${order.customerId}`
      );
    }
  }
}
export default OrderConfirmationHandler;
