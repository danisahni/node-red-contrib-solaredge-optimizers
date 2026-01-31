export class SolarEdgeOptimizerData {
  serialnumber: string;
  panel_id: string;
  panel_description: string;
  lastmeasurement: Date;
  model: string;
  manufacturer: string;
  current: number;
  optimizer_voltage: number;
  power: number;
  voltage: number;
  lifetime_energy: number = 0;

  constructor(panelId: string, jsonObject: any) {
    this.serialnumber = jsonObject.serialNumber;
    this.panel_id = panelId;
    this.panel_description = jsonObject.description;

    // Parse the date like Python version
    const rawDate = jsonObject.lastMeasurementDate;
    const dateParts = rawDate.split(" ");
    const newTime = `${dateParts[0]} ${dateParts[1]} ${dateParts[2]} ${dateParts[3]} ${dateParts[5]}`;
    this.lastmeasurement = new Date(newTime);

    this.model = jsonObject.model;
    this.manufacturer = jsonObject.manufacturer;

    this.current = parseFloat(jsonObject.measurements["Current [A]"]);
    this.optimizer_voltage = parseFloat(
      jsonObject.measurements["Optimizer Voltage [V]"]
    );
    this.power = parseFloat(jsonObject.measurements["Power [W]"]);
    this.voltage = parseFloat(jsonObject.measurements["Voltage [V]"]);
  }
}
