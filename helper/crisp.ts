import React, { Component } from "react";

import { Crisp } from "crisp-sdk-web";

class CrispChat extends Component {
  componentDidMount () {
    Crisp.configure("26621a32-c4ac-4d6a-936d-b78b1a9bf2ce");
  }

  render () {
    return null;
  }
}
export default CrispChat