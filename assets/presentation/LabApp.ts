import { _decorator, Component } from 'cc';
import { BombermanApp } from './BombermanApp';
import { PrototypeApp } from './PrototypeApp';
const {ccclass,property}=_decorator;
@ccclass('LabApp')
export class LabApp extends Component {
 @property experimental = false;
 start():void {if(this.experimental)this.node.addComponent(PrototypeApp);else this.node.addComponent(BombermanApp);}
}
