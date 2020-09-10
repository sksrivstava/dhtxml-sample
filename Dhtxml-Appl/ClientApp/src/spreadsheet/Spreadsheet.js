import React, {Component} from "react";
import {Spreadsheet} from "dhx-spreadsheet";
import PropTypes from "prop-types";
import "../codebase/spreadsheet.css";
class SpreadsheetComponent extends Component {
	componentDidMount() {
		this.spreadsheet = new Spreadsheet(this.el, {
			menu: true, //this.props.menu,
			editLine: true,
			toolbar: this.props.toolbar,
			rowsCount: this.props.rowsCount,
			colsCount: this.props.colsCount
		});
		this.spreadsheet.load("./Sample1.xlsx", "xlsx");
		this.spreadsheet.export.xlsx();
	}

	ExportExcel(args) {
		//var this.spreadsheet = new dhx.Spreadsheet(document.body, {
		//	importModulePath: "../libs/excel2json/1.0/worker.js"
		//});
		//this.spreadsheet.export.xlsx();
	}
	//componentWillUnmount() {
	//	this.spreadsheet.destructor();
	//}

	render() {
		return (
			<div>
				<div>
					<button onClick={this.ExportExcel()}>Export file</button>
				</div>
				<div ref={el => this.el = el} className="widget-box" style={{ width: 800, height: 400 }}></div>
				</div>
		);
	}
}

SpreadsheetComponent.propTypes = {
	menu: PropTypes.bool,
	editLine: PropTypes.bool,
	toolbar: PropTypes.array,
	rowsCount: PropTypes.number,
	colsCount: PropTypes.number
};

export default SpreadsheetComponent;
