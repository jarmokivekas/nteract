import * as React from "react";
import { WidgetManager } from "../renderer/widget-manager";
import Renderer from "../renderer";
import BackboneWrapper from "../renderer/backbone-wrapper";
import { connect } from "react-redux";
import { Dispatch } from "redux";
import { AppState, selectors } from "@nteract/core";
import { commOpenAction, commMessageAction } from "@nteract/actions";

interface Props {
  model: any;
  model_id: any;
  model_lookup_by_id: (id: string) => any;
  kernel: any;
}

interface State {
  manager: WidgetManager
}

class Manager extends React.Component<Props, State> {
  widgetContainerRef = React.createRef<HTMLDivElement>();
  static manager: WidgetManager;

  constructor(props: Props) {
    super(props);
    this.state = {
      manager: new WidgetManager(this.props.kernel, this.props.model_lookup_by_id)
    };
  }

  getManager(){
    if(Manager.manager == undefined){
      Manager.manager = new WidgetManager(this.props.kernel, this.props.model_lookup_by_id)
    }else{
      Manager.manager.init(this.props.kernel, this.props.model_lookup_by_id);
    }
    return Manager.manager;
  }

  getManager2(){
    this.state.manager.init(this.props.kernel, this.props.model_lookup_by_id);
    return this.state.manager;
  }
  // componentDidUpdate(){
  //   console.log(this.props.comms);
  // }

  componentDidMount() {
    // if (this.widgetContainerRef && this.widgetContainerRef.current !== null) {
    //   this.setState({
    //     manager: new WidgetManager(this.props.dispatch, this.props.model_lookup_by_id)
    //   });
    // }
  }

  render() {
    return (
      <React.Fragment>
        <BackboneWrapper
          model={this.props.model.get("state").toJS()}
          manager={this.getManager()}
          model_id={this.props.model_id}
          widgetContainerRef={this.widgetContainerRef}
        />
      </React.Fragment>
    );
  }
}

const mapStateToProps = (state: AppState, props: Props) => {
  return {
    model_lookup_by_id: (model_id: string) => selectors.modelById(state, { commId: model_id }).toJS(),
    kernel: selectors.currentKernel(state)
  };
};
export default connect(mapStateToProps)(Manager);

