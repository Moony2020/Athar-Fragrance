import { expect, test } from "@playwright/test";

import { customerOrderStatusRows } from "../src/components/orders/customer-order-presentation";

test("customer order status rows use clear, adjacent label and value text", () => {
  expect(customerOrderStatusRows).toEqual([
    { label: "Payment status", value: "Paid" },
    { label: "Your order", value: "Preparing" },
  ]);
});
