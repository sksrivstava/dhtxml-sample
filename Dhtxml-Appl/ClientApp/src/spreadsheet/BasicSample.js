import React, {Component} from "react";
import SpreadsheetComponent from "./Spreadsheet";

class BasicSample extends Component {
	render() {
		return (
			<div className='app-box'>
				<p>Basic spreadsheet</p>
				<SpreadsheetComponent></SpreadsheetComponent>

				
			</div>
		);
	}
}

export default BasicSample;
