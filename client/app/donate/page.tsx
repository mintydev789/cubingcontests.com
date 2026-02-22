import { C } from "~/helpers/constants.ts";

function DonatePage() {
  return (
    <section className="px-3">
      <h1 className="mb-4 text-center">Donate</h1>
      <p>
        If you would like to support the development and maintenance of Cubing Contests, you can use one of the donation
        methods below. You will be directly supporting Deni Mintsaev, the main developer and maintainer of Cubing
        Contests.
      </p>

      <h3 className="cc-basic-heading">PayPal Donations</h3>
      <p>You can make a single donation or make donations monthly or annually on PayPal.</p>
      <a
        href="https://www.paypal.com/donate/?hosted_button_id=L5CZ35VXKU7VA"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary mt-2"
      >
        Donate
      </a>

      <h3 className="cc-basic-heading">GitHub Sponsorship</h3>
      <p>You can become a one-time or recurring sponsor of Deni Mintsaev on GitHub.</p>
      <a
        href="https://github.com/sponsors/mintydev789"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-success mt-2"
      >
        Support
      </a>

      <h3 className="cc-basic-heading">Monero</h3>
      <p>You can send a Monero (cryptocurrency) donation to the following XMR wallet:</p>
      <p className="fw-bold mt-4 rounded-3 border p-3">{C.moneroDonationAddress}</p>
    </section>
  );
}

export default DonatePage;
