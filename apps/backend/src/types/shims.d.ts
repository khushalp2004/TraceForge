declare module "cors" {
  const cors: (...args: any[]) => any;
  export default cors;
}

declare module "nodemailer" {
  export type Transporter = {
    sendMail: (options: any) => Promise<any>;
  };

  const nodemailer: {
    createTransport: (options: any) => Transporter;
  };

  export default nodemailer;
}
