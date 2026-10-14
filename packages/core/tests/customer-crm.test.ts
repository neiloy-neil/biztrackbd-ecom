import { describe, expect, it } from "vitest";
import {
  adjustCustomerStoreCredit,
  createCustomer,
  saveCustomerAddress,
  sendCustomerDirectSms,
  updateCustomer,
  type StaffActor,
} from "../src";
import { ValidationError } from "../src/errors";

const mockActor: StaffActor = {
  userId: "user-1",
  email: "owner@example.com",
  name: "Owner",
  role: "STORE_OWNER",
};

describe("Customer CRM Unit Validations", () => {
  it("rejects invalid customer name or invalid phone number", async () => {
    await expect(
      createCustomer("tenant-1", mockActor, { name: "A", phone: "01712345678" }),
    ).rejects.toThrow(ValidationError);

    await expect(
      createCustomer("tenant-1", mockActor, { name: "Valid Name", phone: "1234" }),
    ).rejects.toThrow();
  });

  it("validates birthday range on updateCustomer", async () => {
    await expect(
      updateCustomer("tenant-1", mockActor, "cust-1", { birthMonth: 13 }),
    ).rejects.toThrow("Birth month must be 1 to 12");

    await expect(
      updateCustomer("tenant-1", mockActor, "cust-1", { birthDay: 32 }),
    ).rejects.toThrow("Birth day must be 1 to 31");
  });

  it("validates store credit adjustment parameters", async () => {
    await expect(
      adjustCustomerStoreCredit("tenant-1", mockActor, "cust-1", 0, "Valid reason"),
    ).rejects.toThrow("Enter a non-zero amount in Taka");

    await expect(
      adjustCustomerStoreCredit("tenant-1", mockActor, "cust-1", 100, "no"),
    ).rejects.toThrow("Write the reason, at least 3 characters");
  });

  it("validates address fields on saveCustomerAddress", async () => {
    await expect(
      saveCustomerAddress("tenant-1", mockActor, "cust-1", {
        address: "Hi",
        district: "Dhaka",
        division: "Dhaka",
      }),
    ).rejects.toThrow("Enter the street address");

    await expect(
      saveCustomerAddress("tenant-1", mockActor, "cust-1", {
        address: "House 10, Road 4",
        district: "",
        division: "Dhaka",
      }),
    ).rejects.toThrow("Select the district");
  });

  it("validates direct SMS message length", async () => {
    await expect(
      sendCustomerDirectSms("tenant-1", mockActor, "cust-1", "ok"),
    ).rejects.toThrow("Message must be between 3 and 500 characters");

    await expect(
      sendCustomerDirectSms("tenant-1", mockActor, "cust-1", "a".repeat(501)),
    ).rejects.toThrow("Message must be between 3 and 500 characters");
  });
});
